import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { todayIn } from './../src/common/time/hotel-date.js';

/** Fecha (YYYY-MM-DD) a n días de hoy en la zona por defecto del hotel. */
function inDays(n: number): string {
  const d = new Date(`${todayIn('America/Mexico_City')}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Crea su propio hotel con usuarios de cada rol y lo borra al terminar.
describe('Configuración y catálogo de habitaciones (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let hotelId: string;
  const tokens: Record<'admin' | 'recep' | 'limpieza', string> = {
    admin: '',
    recep: '',
    limpieza: '',
  };
  let housekeeperId: string;

  const run = randomUUID().slice(0, 8);
  const password = 'secreto123';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const passwordHash = await hash(password);
    const hotel = await prisma.hotel.create({
      data: { name: `Hotel Catálogo ${run}` },
    });
    hotelId = hotel.id;
    const roles = {
      admin: 'ADMIN',
      recep: 'RECEPTION',
      limpieza: 'HOUSEKEEPING',
    } as const;
    for (const [key, role] of Object.entries(roles)) {
      const user = await prisma.user.create({
        data: {
          hotelId,
          role,
          passwordHash,
          name: `${key} ${run}`,
          email: `e2e-${key}-${run}@test.com`,
        },
      });
      if (role === 'HOUSEKEEPING') housekeeperId = user.id;
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: user.email, password });
      tokens[key as keyof typeof tokens] = res.body.accessToken;
    }
  });

  afterAll(async () => {
    await prisma.roomStatusLog.deleteMany({ where: { hotelId } });
    await prisma.room.deleteMany({ where: { hotelId } });
    await prisma.roomType.deleteMany({ where: { hotelId } });
    await prisma.user.deleteMany({ where: { hotelId } });
    await prisma.hotel.delete({ where: { id: hotelId } }); // borra settings en cascada
    await app.close();
  });

  const as = (who: keyof typeof tokens) => {
    const http = request(app.getHttpServer());
    const auth = { Authorization: `Bearer ${tokens[who]}` };
    return {
      get: (url: string) => http.get(url).set(auth),
      post: (url: string, body: object) => http.post(url).set(auth).send(body),
      patch: (url: string, body: object) =>
        http.patch(url).set(auth).send(body),
    };
  };

  let typeId: string;
  let roomId: string;

  it('crea la configuración con los valores por defecto', async () => {
    const res = await as('recep').get('/api/hotel').expect(200);
    expect(res.body.settings).toMatchObject({
      hourlyRatePercent: 15,
      minHours: 3,
      dayRatePercent: 120,
      dayDurationHours: 24,
      weekRatePercent: 600,
      checkInTime: '15:00',
      checkOutTime: '12:00',
    });
  });

  it('solo ADMIN cambia la configuración y se valida el formato', async () => {
    await as('recep').patch('/api/hotel/settings', { minHours: 4 }).expect(403);
    const bad = await as('admin')
      .patch('/api/hotel/settings', { checkInTime: '25:00' })
      .expect(400);
    expect(bad.body.message[0]).toMatch(/HH:mm/);
    await as('admin').patch('/api/hotel/settings', { minHours: 4 }).expect(200);
  });

  it('el tipo de habitación devuelve las 4 tarifas calculadas', async () => {
    const res = await as('admin')
      .post('/api/room-types', {
        name: 'Doble',
        maxAdults: 2,
        nightlyRate: 1250,
        amenities: ['WIFI', 'TV'],
      })
      .expect(201);
    typeId = res.body.id;
    // 15 % de 1250 = 187.5 → 188 (peso más cercano)
    expect(res.body.rates).toEqual({
      hourly: 188,
      nightly: 1250,
      daily: 1500,
      weekly: 7500,
    });

    await as('admin')
      .post('/api/room-types', { name: 'Doble', maxAdults: 2, nightlyRate: 1 })
      .expect(409);
    const decimal = await as('admin')
      .post('/api/room-types', { name: 'X', maxAdults: 2, nightlyRate: 99.5 })
      .expect(400);
    expect(decimal.body.message).toContain(
      'El precio por noche debe ser en pesos enteros',
    );
  });

  it('las tarifas siguen la configuración del hotel', async () => {
    await as('admin')
      .patch('/api/hotel/settings', { hourlyRatePercent: 20 })
      .expect(200);
    const res = await as('recep').get(`/api/room-types/${typeId}`).expect(200);
    expect(res.body.rates.hourly).toBe(250);
  });

  it('crea habitaciones con número único por hotel', async () => {
    const res = await as('admin')
      .post('/api/rooms', { number: ' 101 ', floor: 1, roomTypeId: typeId })
      .expect(201);
    roomId = res.body.id;
    expect(res.body.number).toBe('101');
    expect(res.body.status).toBe('AVAILABLE');

    await as('admin')
      .post('/api/rooms', { number: '101', floor: 1, roomTypeId: typeId })
      .expect(409);
    await as('recep')
      .post('/api/rooms', { number: '102', floor: 1, roomTypeId: typeId })
      .expect(403);
  });

  it('limpieza solo puede iniciar y terminar limpiezas', async () => {
    await as('limpieza')
      .patch(`/api/rooms/${roomId}/status`, { status: 'MAINTENANCE' })
      .expect(403);
    await as('limpieza')
      .patch(`/api/rooms/${roomId}/status`, { status: 'CLEANING' })
      .expect(200);
  });

  it('al terminar la limpieza registra quién limpió y cuándo', async () => {
    const res = await as('limpieza')
      .patch(`/api/rooms/${roomId}/status`, { status: 'AVAILABLE' })
      .expect(200);
    expect(res.body.lastCleanedBy.id).toBe(housekeeperId);
    expect(res.body.lastCleanedAt).toEqual(expect.any(String));

    const history = await as('recep')
      .get(`/api/rooms/${roomId}/history`)
      .expect(200);
    expect(history.body[0]).toMatchObject({
      fromStatus: 'CLEANING',
      toStatus: 'AVAILABLE',
      cleanedBy: { id: housekeeperId },
    });
    expect(history.body[0].cleanedAt).toEqual(expect.any(String));
  });

  it('recepción puede indicar qué persona de limpieza limpió', async () => {
    await as('recep')
      .patch(`/api/rooms/${roomId}/status`, { status: 'CLEANING' })
      .expect(200);

    const housekeepers = await as('recep')
      .get('/api/rooms/housekeepers')
      .expect(200);
    expect(housekeepers.body).toEqual([
      { id: housekeeperId, name: expect.any(String) },
    ]);

    const res = await as('recep')
      .patch(`/api/rooms/${roomId}/status`, {
        status: 'AVAILABLE',
        cleanedById: housekeeperId,
      })
      .expect(200);
    expect(res.body.lastCleanedBy.id).toBe(housekeeperId);
  });

  it('rechaza cambios inválidos con mensajes en español', async () => {
    const same = await as('recep')
      .patch(`/api/rooms/${roomId}/status`, { status: 'AVAILABLE' })
      .expect(400);
    expect(same.body.message).toBe(
      'La habitación ya está en estado «Disponible»',
    );

    const notCleaning = await as('recep')
      .patch(`/api/rooms/${roomId}/status`, {
        status: 'MAINTENANCE',
        reason: 'Revisión',
        blockedUntil: inDays(1),
        cleanedById: housekeeperId,
      })
      .expect(400);
    expect(notCleaning.body.message).toMatch(/quién limpió/);
  });

  it('mantenimiento exige motivo', async () => {
    const res = await as('recep')
      .patch(`/api/rooms/${roomId}/status`, { status: 'MAINTENANCE' })
      .expect(400);
    expect(res.body.message).toBe(
      'Indica el motivo para pasar la habitación a «Mantenimiento»',
    );
    await as('recep')
      .patch(`/api/rooms/${roomId}/status`, {
        status: 'MAINTENANCE',
        reason: 'Fuga en el lavabo',
        blockedUntil: inDays(2),
      })
      .expect(200);
    await as('recep')
      .patch(`/api/rooms/${roomId}/status`, { status: 'AVAILABLE' })
      .expect(200);
  });

  it('configura impuestos, tope por hora y edad de niño', async () => {
    const res = await as('admin')
      .patch('/api/hotel/settings', {
        vatPercent: 16,
        lodgingTaxPercent: 2.5,
        childMaxAge: 11,
        capHourlyAtDayRate: false,
      })
      .expect(200);
    expect(res.body).toMatchObject({
      vatPercent: 16,
      lodgingTaxPercent: 2.5,
      childMaxAge: 11,
      capHourlyAtDayRate: false,
    });

    const bad = await as('admin')
      .patch('/api/hotel/settings', {
        lodgingTaxPercent: 2.555,
        childMaxAge: 20,
      })
      .expect(400);
    expect(bad.body.message).toEqual(
      expect.arrayContaining([
        'El ISH debe ser un número con máximo 2 decimales',
        'La edad de niño no puede pasar de 17 años',
      ]),
    );
  });

  it('valida los adultos incluidos contra la capacidad', async () => {
    const res = await as('admin')
      .post('/api/room-types', {
        name: 'Familiar',
        maxAdults: 4,
        includedAdults: 2,
        extraAdultRate: 250,
        extraChildRate: 100,
        nightlyRate: 1500,
      })
      .expect(201);
    expect(res.body).toMatchObject({
      includedAdults: 2,
      extraAdultRate: 250,
      extraChildRate: 100,
    });

    const bad = await as('admin')
      .patch(`/api/room-types/${res.body.id}`, { maxAdults: 1 })
      .expect(400);
    expect(bad.body.message).toBe(
      'Los adultos incluidos no pueden ser más que la capacidad de adultos',
    );

    // Con capacidad de 1 y sin indicar incluidos, se ajusta solo a 1.
    const single = await as('admin')
      .post('/api/room-types', {
        name: 'Individual',
        maxAdults: 1,
        nightlyRate: 600,
      })
      .expect(201);
    expect(single.body.includedAdults).toBe(1);
  });

  it('mantenimiento exige fecha estimada y no acepta fechas pasadas', async () => {
    const url = `/api/rooms/${roomId}/status`;
    const sinFecha = await as('recep')
      .patch(url, { status: 'MAINTENANCE', reason: 'Pintura' })
      .expect(400);
    expect(sinFecha.body.message).toBe(
      'Indica hasta qué fecha estará en «Mantenimiento»',
    );
    const pasada = await as('recep')
      .patch(url, {
        status: 'MAINTENANCE',
        reason: 'Pintura',
        blockedUntil: inDays(-1),
      })
      .expect(400);
    expect(pasada.body.message).toBe(
      'La fecha estimada no puede estar en el pasado',
    );
    const formato = await as('recep')
      .patch(url, {
        status: 'MAINTENANCE',
        reason: 'Pintura',
        blockedUntil: '28/10/2026',
      })
      .expect(400);
    expect(formato.body.message).toContain(
      'La fecha estimada debe tener el formato AAAA-MM-DD',
    );

    const ok = await as('recep')
      .patch(url, {
        status: 'MAINTENANCE',
        reason: 'Pintura',
        blockedUntil: inDays(3),
      })
      .expect(200);
    expect(ok.body).toMatchObject({
      blockedUntil: inDays(3),
      blockOverdue: false,
    });
  });

  it('ajusta la fecha sin cambiar el estado y lo registra en el historial', async () => {
    const res = await as('recep')
      .patch(`/api/rooms/${roomId}/blocked-until`, { blockedUntil: inDays(7) })
      .expect(200);
    expect(res.body).toMatchObject({
      status: 'MAINTENANCE',
      blockedUntil: inDays(7),
    });

    const history = await as('recep')
      .get(`/api/rooms/${roomId}/history`)
      .expect(200);
    expect(history.body[0]).toMatchObject({
      fromStatus: 'MAINTENANCE',
      toStatus: 'MAINTENANCE',
      previousBlockedUntil: inDays(3),
      blockedUntil: inDays(7),
    });

    // Mantenimiento no puede quedar indefinido; limpieza no puede ajustar.
    await as('recep')
      .patch(`/api/rooms/${roomId}/blocked-until`, { blockedUntil: null })
      .expect(400);
    await as('limpieza')
      .patch(`/api/rooms/${roomId}/blocked-until`, { blockedUntil: inDays(8) })
      .expect(403);
  });

  it('fuera de servicio puede ser indefinido y la fecha se borra al liberar', async () => {
    const url = `/api/rooms/${roomId}/status`;
    const oos = await as('recep')
      .patch(url, { status: 'OUT_OF_SERVICE', reason: 'Remodelación' })
      .expect(200);
    expect(oos.body.blockedUntil).toBeNull();

    const freed = await as('recep')
      .patch(url, { status: 'AVAILABLE' })
      .expect(200);
    expect(freed.body.blockedUntil).toBeNull();

    const conFecha = await as('recep')
      .patch(url, { status: 'CLEANING', blockedUntil: inDays(1) })
      .expect(400);
    expect(conFecha.body.message).toMatch(/solo aplica/);
  });

  it('marca y cuenta los bloqueos vencidos', async () => {
    // Simula un bloqueo cuya fecha ya pasó.
    await prisma.room.update({
      where: { id: roomId },
      data: {
        status: 'MAINTENANCE',
        blockedUntil: new Date(`${inDays(-2)}T00:00:00Z`),
      },
    });
    const rooms = await as('recep').get('/api/rooms?overdue=true').expect(200);
    expect(rooms.body).toHaveLength(1);
    expect(rooms.body[0].blockOverdue).toBe(true);

    const summary = await as('recep').get('/api/rooms/summary').expect(200);
    expect(summary.body.overdue).toBe(1);

    await prisma.room.update({
      where: { id: roomId },
      data: { status: 'AVAILABLE', blockedUntil: null },
    });
  });

  it('valida la zona horaria del hotel', async () => {
    const bad = await as('admin')
      .patch('/api/hotel', { timezone: 'Mexico/Nada' })
      .expect(400);
    expect(bad.body.message).toContain('La zona horaria no es válida');
    const ok = await as('admin')
      .patch('/api/hotel', { timezone: 'America/Cancun' })
      .expect(200);
    expect(ok.body.timezone).toBe('America/Cancun');
    await as('admin')
      .patch('/api/hotel', { timezone: 'America/Mexico_City' })
      .expect(200);
  });

  it('resume las habitaciones por estado', async () => {
    const res = await as('limpieza').get('/api/rooms/summary').expect(200);
    expect(res.body.total).toBe(1);
    expect(res.body.byStatus.AVAILABLE).toBe(1);
  });
});
