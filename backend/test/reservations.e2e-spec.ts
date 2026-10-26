import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { addDaysTo, todayIn } from './../src/common/time/hotel-date.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

const TZ = 'America/Mexico_City';
const day = (n: number) => addDaysTo(todayIn(TZ), n);

// Crea su propio hotel (2 Dobles, 1 Suite) y lo borra al terminar.
describe('Reservas (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let hotelId: string;
  let dobleId: string;
  let suiteId: string;
  let guestId: string;
  let blockedGuestId: string;
  const tokens = { recep: '', limpieza: '' };
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

    const hotel = await prisma.hotel.create({
      data: { name: `Hotel Reservas ${run}`, settings: { create: {} } },
    });
    hotelId = hotel.id;
    const passwordHash = await hash(password);
    for (const [key, role] of [
      ['recep', 'RECEPTION'],
      ['limpieza', 'HOUSEKEEPING'],
    ] as const) {
      const user = await prisma.user.create({
        data: {
          hotelId,
          role,
          passwordHash,
          name: key,
          email: `e2e-r-${key}-${run}@test.com`,
        },
      });
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: user.email, password });
      tokens[key] = res.body.accessToken;
    }

    const doble = await prisma.roomType.create({
      data: {
        hotelId,
        name: 'Doble',
        maxAdults: 4,
        maxChildren: 2,
        nightlyRate: 1000,
        includedAdults: 2,
        extraAdultRate: 250,
        extraChildRate: 100,
      },
    });
    const suite = await prisma.roomType.create({
      data: { hotelId, name: 'Suite', maxAdults: 2, nightlyRate: 2500 },
    });
    dobleId = doble.id;
    suiteId = suite.id;
    await prisma.room.createMany({
      data: [
        { hotelId, roomTypeId: dobleId, number: '101', floor: 1 },
        { hotelId, roomTypeId: dobleId, number: '102', floor: 1 },
        { hotelId, roomTypeId: suiteId, number: '201', floor: 2 },
      ],
    });
    const guest = await prisma.guest.create({
      data: {
        hotelId,
        firstName: 'Ana',
        lastName: 'Reservas',
        phone: '9981112233',
        searchText: 'ana reservas 9981112233',
      },
    });
    const blocked = await prisma.guest.create({
      data: {
        hotelId,
        firstName: 'Beto',
        lastName: 'Bloqueado',
        phone: '9984445566',
        isBlocked: true,
        blockedReason: 'Daños',
      },
    });
    guestId = guest.id;
    blockedGuestId = blocked.id;
  });

  afterAll(async () => {
    await prisma.reservation.deleteMany({ where: { hotelId } });
    await prisma.room.deleteMany({ where: { hotelId } });
    await prisma.roomType.deleteMany({ where: { hotelId } });
    await prisma.guest.deleteMany({ where: { hotelId } });
    await prisma.user.deleteMany({ where: { hotelId } });
    await prisma.hotel.delete({ where: { id: hotelId } });
    await app.close();
  });

  const as = (who: keyof typeof tokens) => {
    const http = request(app.getHttpServer());
    const auth = { Authorization: `Bearer ${tokens[who]}` };
    return {
      get: (url: string) => http.get(url).set(auth),
      post: (url: string, body: object = {}) =>
        http.post(url).set(auth).send(body),
      patch: (url: string, body: object) =>
        http.patch(url).set(auth).send(body),
    };
  };

  const nightly = (from: number, to: number, extra: object = {}) => ({
    modality: 'NIGHTLY',
    arrivalDate: day(from),
    departureDate: day(to),
    adults: 2,
    guestId,
    roomTypeId: dobleId,
    source: 'PHONE',
    ...extra,
  });

  it('limpieza no tiene acceso a reservas', async () => {
    await as('limpieza').get('/api/reservations').expect(403);
  });

  it('cotiza disponibilidad y precio por tipo', async () => {
    const res = await as('recep')
      .post('/api/reservations/quote', {
        modality: 'NIGHTLY',
        arrivalDate: day(10),
        departureDate: day(13),
        adults: 3,
        children: 1,
      })
      .expect(201);
    const doble = res.body.options.find(
      (o: { roomType: { name: string } }) => o.roomType.name === 'Doble',
    );
    const suite = res.body.options.find(
      (o: { roomType: { name: string } }) => o.roomType.name === 'Suite',
    );
    // 3 noches × 1000 + (1 adulto × 250 + 1 niño × 100) × 3 = 4050
    expect(doble).toMatchObject({
      available: 2,
      fitsGuests: true,
      quote: { baseAmount: 3000, extrasAmount: 1050, totalAmount: 4050 },
    });
    expect(suite.fitsGuests).toBe(false);
    expect(res.body.units).toBe(3);
  });

  it('crea una reserva con folio y precio congelado', async () => {
    const res = await as('recep')
      .post('/api/reservations', nightly(10, 13, { requiresDeposit: true }))
      .expect(201);
    expect(res.body).toMatchObject({
      code: 'R-000001',
      status: 'CONFIRMED',
      units: 3,
      totalAmount: 3000,
      requiresDeposit: true,
      roomId: null,
      guest: { firstName: 'Ana' },
    });
    expect(res.body.pricing.taxes.total).toBe(3000);
  });

  it('valida capacidad, huésped bloqueado y fechas pasadas', async () => {
    const cap = await as('recep')
      .post(
        '/api/reservations',
        nightly(20, 21, { roomTypeId: suiteId, adults: 3 }),
      )
      .expect(400);
    expect(cap.body.message).toBe('«Suite» admite hasta 2 adultos y 0 niños');

    const blocked = await as('recep')
      .post('/api/reservations', nightly(20, 21, { guestId: blockedGuestId }))
      .expect(400);
    expect(blocked.body.message).toMatch(/bloqueado/);

    const past = await as('recep')
      .post('/api/reservations', nightly(-2, 1))
      .expect(400);
    expect(past.body.message).toBe('No se puede reservar en el pasado');

    const same = await as('recep')
      .post('/api/reservations', nightly(20, 20))
      .expect(400);
    expect(same.body.message).toMatch(/al menos un día después/);
  });

  it('no permite sobreventa y respeta el cambio de turno', async () => {
    const suite = (from: number, to: number) =>
      nightly(from, to, { roomTypeId: suiteId });
    await as('recep').post('/api/reservations', suite(30, 33)).expect(201);

    const over = await as('recep')
      .post('/api/reservations', suite(32, 34))
      .expect(409);
    expect(over.body.message).toBe(
      'No hay habitaciones «Suite» disponibles en esas fechas',
    );
    // Sale a las 12:00 del día 33 y el siguiente entra a las 15:00: sí cabe.
    await as('recep').post('/api/reservations', suite(33, 35)).expect(201);
  });

  it('dos reservas simultáneas del último cuarto: solo una gana', async () => {
    const suite = nightly(40, 42, { roomTypeId: suiteId });
    const [a, b] = await Promise.all([
      as('recep').post('/api/reservations', suite),
      as('recep').post('/api/reservations', suite),
    ]);
    expect([a.status, b.status].sort((x, y) => x - y)).toEqual([201, 409]);
  });

  it('una habitación en mantenimiento no se puede vender en esas fechas', async () => {
    await prisma.room.updateMany({
      where: { hotelId, number: '101' },
      data: {
        status: 'MAINTENANCE',
        blockedUntil: new Date(`${day(51)}T00:00:00Z`),
      },
    });
    const quote = (from: number, to: number) =>
      as('recep').post('/api/reservations/quote', {
        modality: 'NIGHTLY',
        arrivalDate: day(from),
        departureDate: day(to),
        adults: 2,
      });
    const during = await quote(50, 52).expect(201);
    const after = await quote(52, 53).expect(201);
    const doble = (r: request.Response) =>
      r.body.options.find(
        (o: { roomType: { name: string } }) => o.roomType.name === 'Doble',
      );
    expect(doble(during).available).toBe(1);
    expect(doble(after).available).toBe(2);
    await prisma.room.updateMany({
      where: { hotelId, number: '101' },
      data: { status: 'AVAILABLE', blockedUntil: null },
    });
  });

  it('por horas aplica mínimo y tope del día', async () => {
    const res = await as('recep')
      .post('/api/reservations', {
        modality: 'HOURLY',
        arrivalDate: day(60),
        arrivalTime: '22:00',
        units: 10,
        adults: 2,
        guestId,
        roomTypeId: dobleId,
        source: 'WALK_IN',
      })
      .expect(201);
    expect(res.body.totalAmount).toBe(1200);
    expect(res.body.pricing).toMatchObject({
      billedHours: 10,
      cappedAtDay: true,
    });
  });

  it('modifica con recálculo, cancela con motivo y libera el cuarto', async () => {
    const created = await as('recep')
      .post('/api/reservations', nightly(70, 71))
      .expect(201);
    const id = created.body.id;

    const updated = await as('recep')
      .patch(`/api/reservations/${id}`, {
        modality: 'NIGHTLY',
        arrivalDate: day(70),
        departureDate: day(72),
        adults: 3,
      })
      .expect(200);
    expect(updated.body).toMatchObject({ units: 2, totalAmount: 2500 });

    const noReason = await as('recep')
      .post(`/api/reservations/${id}/cancel`, {})
      .expect(400);
    expect(noReason.body.message).toContain(
      'Indica el motivo de la cancelación',
    );

    const cancelled = await as('recep')
      .post(`/api/reservations/${id}/cancel`, { reason: 'Cambio de planes' })
      .expect(201);
    expect(cancelled.body).toMatchObject({
      status: 'CANCELLED',
      cancelReason: 'Cambio de planes',
    });
    await as('recep')
      .patch(`/api/reservations/${id}`, { notes: 'x' })
      .expect(400);
  });

  it('no-show solo después de la hora de entrada', async () => {
    const created = await as('recep')
      .post('/api/reservations', nightly(80, 81))
      .expect(201);
    const early = await as('recep')
      .post(`/api/reservations/${created.body.id}/no-show`)
      .expect(400);
    expect(early.body.message).toMatch(/Aún no llega la hora de entrada/);
  });

  it('busca por folio o por huésped y arma el calendario', async () => {
    const byCode = await as('recep')
      .get('/api/reservations?search=1')
      .expect(200);
    expect(byCode.body.data[0].code).toBe('R-000001');

    const byGuest = await as('recep')
      .get('/api/reservations?search=ana')
      .expect(200);
    expect(byGuest.body.total).toBeGreaterThan(1);

    const cal = await as('recep')
      .get(`/api/reservations/calendar?from=${day(10)}&days=5`)
      .expect(200);
    const dobleRow = cal.body.rows.find(
      (r: { roomType: { name: string } }) => r.roomType.name === 'Doble',
    );
    expect(dobleRow.total).toBe(2);
    // Del día 10 al 13 hay 1 Doble reservada.
    expect(dobleRow.days[1]).toMatchObject({
      sellable: 2,
      booked: 1,
      available: 1,
    });
    expect(dobleRow.days[4]).toMatchObject({ booked: 0 });
  });
});
