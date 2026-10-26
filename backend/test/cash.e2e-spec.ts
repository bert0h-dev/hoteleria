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

// Hotel propio: Doble a $1,000 la noche.
describe('Caja: turnos, corte y bitácora (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let hotelId: string;
  let typeId: string;
  let guestId: string;
  const tokens = { admin: '', recep: '', recep2: '', limpieza: '' };
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

    hotelId = (
      await prisma.hotel.create({
        data: { name: `Hotel Caja ${run}`, settings: { create: {} } },
      })
    ).id;
    const passwordHash = await hash(password);
    for (const [key, role] of [
      ['admin', 'ADMIN'],
      ['recep', 'RECEPTION'],
      ['recep2', 'RECEPTION'],
      ['limpieza', 'HOUSEKEEPING'],
    ] as const) {
      const user = await prisma.user.create({
        data: {
          hotelId,
          role,
          passwordHash,
          name: key,
          email: `e2e-c-${key}-${run}@test.com`,
        },
      });
      tokens[key] = (
        await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({ email: user.email, password })
      ).body.accessToken;
    }
    typeId = (
      await prisma.roomType.create({
        data: { hotelId, name: 'Doble', maxAdults: 4, nightlyRate: 1000 },
      })
    ).id;
    for (const number of ['101', '102']) {
      await prisma.room.create({
        data: { hotelId, roomTypeId: typeId, number, floor: 1 },
      });
    }
    guestId = (
      await prisma.guest.create({
        data: { hotelId, firstName: 'Luis', lastName: 'Caja' },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.reservation.deleteMany({ where: { hotelId } });
    await prisma.room.deleteMany({ where: { hotelId } });
    await prisma.roomType.deleteMany({ where: { hotelId } });
    await prisma.guest.deleteMany({ where: { hotelId } });
    await prisma.exchangeRate.deleteMany({ where: { hotelId } });
    await prisma.auditLog.deleteMany({ where: { hotelId } });
    await prisma.cashShift.deleteMany({ where: { hotelId } });
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
      put: (url: string, body: object) => http.put(url).set(auth).send(body),
    };
  };

  const newReservation = async () =>
    (
      await as('recep')
        .post('/api/reservations', {
          modality: 'NIGHTLY',
          arrivalDate: addDaysTo(todayIn(TZ), 20),
          departureDate: addDaysTo(todayIn(TZ), 23),
          adults: 2,
          guestId,
          roomTypeId: typeId,
          source: 'PHONE',
        })
        .expect(201)
    ).body.id as string;

  let shiftId: string;

  it('cada recepcionista abre su turno con fondo en pesos y dólares', async () => {
    expect((await as('recep').get('/api/cash-shifts/current')).body).toEqual(
      {},
    );
    const bad = await as('recep')
      .post('/api/cash-shifts', { openingMxn: -5 })
      .expect(400);
    expect(bad.body.message).toEqual([
      'El fondo en pesos no puede ser negativo',
    ]);

    const opened = await as('recep')
      .post('/api/cash-shifts', { openingMxn: 1000, openingUsd: 50 })
      .expect(201);
    shiftId = opened.body.id;
    expect(opened.body).toMatchObject({
      openingMxnCents: 100000,
      openingUsdCents: 5000,
      totals: { expectedMxnCents: 100000, expectedUsdCents: 5000 },
    });

    const twice = await as('recep').post('/api/cash-shifts', {}).expect(409);
    expect(twice.body.message).toBe('Ya tienes un turno de caja abierto');

    // El otro recepcionista tiene su propio turno.
    await as('recep2').post('/api/cash-shifts', {}).expect(201);
    // Limpieza no maneja caja.
    await as('limpieza').post('/api/cash-shifts', {}).expect(403);
  });

  it('los cobros entran al turno de quien cobra y calculan el esperado', async () => {
    const id = await newReservation();
    await as('recep')
      .post(`/api/reservations/${id}/payments`, { method: 'CASH', amount: 300 })
      .expect(201);
    await as('recep')
      .post(`/api/reservations/${id}/payments`, {
        method: 'DEBIT_CARD',
        amount: 200,
        reference: '1234',
      })
      .expect(201);
    await as('recep').put('/api/exchange-rates/today', { rate: 17.5 });
    await as('recep')
      .post(`/api/reservations/${id}/payments`, {
        method: 'CASH',
        currency: 'USD',
        amount: 10,
      })
      .expect(201);
    // Este lo cobra el otro recepcionista: va a su turno.
    await as('recep2')
      .post(`/api/reservations/${id}/payments`, { method: 'CASH', amount: 50 })
      .expect(201);

    const current = await as('recep').get('/api/cash-shifts/current');
    expect(current.body.totals).toMatchObject({
      expectedMxnCents: 100000 + 30000,
      expectedUsdCents: 5000 + 1000,
      netMxnCents: 30000 + 20000 + 17500,
    });
  });

  it('corte: si falta efectivo exige comentario; luego ya no puede cobrar', async () => {
    const short = await as('recep')
      .post(`/api/cash-shifts/${shiftId}/close`, {
        countedMxn: 1250,
        countedUsd: 60,
      })
      .expect(400);
    expect(short.body.message).toBe(
      'Falta efectivo: escribe un comentario para cerrar el turno',
    );

    const closed = await as('recep')
      .post(`/api/cash-shifts/${shiftId}/close`, {
        countedMxn: 1250,
        countedUsd: 60,
        notes: 'Faltan 50 pesos de cambio',
      })
      .expect(201);
    expect(closed.body).toMatchObject({
      expectedMxnCents: 130000,
      countedMxnCents: 125000,
      expectedUsdCents: 6000,
      countedUsdCents: 6000,
      closingNotes: 'Faltan 50 pesos de cambio',
      closedBy: { name: 'recep' },
    });
    expect(closed.body.payments).toHaveLength(3);

    await as('recep')
      .post(`/api/cash-shifts/${shiftId}/close`, { countedMxn: 0 })
      .expect(400);
    const id = await newReservation();
    await as('recep')
      .post(`/api/reservations/${id}/payments`, { method: 'CASH', amount: 1 })
      .expect(409);
  });

  it('solo el ADMIN ve el historial y cierra turnos ajenos', async () => {
    await as('recep').get('/api/cash-shifts').expect(403);
    const open = await as('admin')
      .get('/api/cash-shifts?status=open')
      .expect(200);
    expect(open.body.data).toHaveLength(1);
    const other = open.body.data[0];
    expect(other.user.name).toBe('recep2');

    await as('recep').get(`/api/cash-shifts/${other.id}`).expect(403);
    await as('recep')
      .post(`/api/cash-shifts/${other.id}/close`, { countedMxn: 50 })
      .expect(403);
    const closed = await as('admin')
      .post(`/api/cash-shifts/${other.id}/close`, { countedMxn: 50 })
      .expect(201);
    expect(closed.body.closedBy.name).toBe('admin');

    const audit = await as('admin')
      .get('/api/audit-logs?entity=cash_shift')
      .expect(200);
    expect(audit.body.data[0].summary).toBe(
      'Cerró el turno de caja de recep2: diferencia de $0.00 MXN y $0.00 USD',
    );
    expect(audit.body.total).toBe(4);
  });
});
