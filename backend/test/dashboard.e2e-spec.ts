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

// Hotel propio: 4 habitaciones (1 ocupada, 1 sucia, 1 en mantenimiento).
describe('Tablero de Inicio (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let hotelId: string;
  let typeId: string;
  let guestId: string;
  const roomIds: string[] = [];
  const tokens = { admin: '', limpieza: '' };
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
        data: { name: `Hotel Tablero ${run}`, settings: { create: {} } },
      })
    ).id;
    const passwordHash = await hash(password);
    for (const [key, role] of [
      ['admin', 'ADMIN'],
      ['limpieza', 'HOUSEKEEPING'],
    ] as const) {
      const user = await prisma.user.create({
        data: {
          hotelId,
          role,
          passwordHash,
          name: key,
          email: `e2e-d-${key}-${run}@test.com`,
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
    for (const [number, status] of [
      ['101', 'AVAILABLE'],
      ['102', 'AVAILABLE'],
      ['103', 'CLEANING'],
      ['104', 'MAINTENANCE'],
    ] as const) {
      roomIds.push(
        (
          await prisma.room.create({
            data: {
              hotelId,
              roomTypeId: typeId,
              number,
              floor: 1,
              status,
              blockedUntil:
                status === 'MAINTENANCE'
                  ? new Date(`${addDaysTo(todayIn(TZ), 30)}T00:00:00Z`)
                  : null,
            },
          })
        ).id,
      );
    }
    guestId = (
      await prisma.guest.create({
        data: { hotelId, firstName: 'Eva', lastName: 'Tablero' },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.reservation.deleteMany({ where: { hotelId } });
    await prisma.roomStatusLog.deleteMany({ where: { hotelId } });
    await prisma.room.deleteMany({ where: { hotelId } });
    await prisma.roomType.deleteMany({ where: { hotelId } });
    await prisma.guest.deleteMany({ where: { hotelId } });
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
    };
  };

  it('el ADMIN ve ocupación, cobrado del día, previsión y avisos', async () => {
    // Llegada sin reserva a la 101 con un pago de $400.
    const walkIn = await as('admin')
      .post('/api/reservations/walk-in', {
        modality: 'NIGHTLY',
        arrivalDate: todayIn(TZ),
        departureDate: addDaysTo(todayIn(TZ), 2),
        adults: 2,
        guestId,
        roomTypeId: typeId,
        source: 'WALK_IN',
        roomId: roomIds[0],
      })
      .expect(201);
    await as('admin').post('/api/cash-shifts', {}).expect(201);
    await as('admin')
      .post(`/api/reservations/${walkIn.body.id}/payments`, {
        method: 'CASH',
        amount: 400,
      })
      .expect(201);
    // Reserva para mañana que exige anticipo y no lo tiene.
    await as('admin')
      .post('/api/reservations', {
        modality: 'NIGHTLY',
        arrivalDate: addDaysTo(todayIn(TZ), 1),
        departureDate: addDaysTo(todayIn(TZ), 2),
        adults: 1,
        guestId,
        roomTypeId: typeId,
        source: 'PHONE',
        requiresDeposit: true,
      })
      .expect(201);

    const res = await as('admin').get('/api/dashboard').expect(200);
    expect(res.body.rooms).toMatchObject({
      total: 4,
      sellable: 3,
      byStatus: { AVAILABLE: 1, OCCUPIED: 1, CLEANING: 1, MAINTENANCE: 1 },
    });
    expect(res.body.rooms.toClean).toEqual([
      expect.objectContaining({ number: '103' }),
    ]);
    expect(res.body.occupancy).toEqual({
      occupied: 1,
      sellable: 3,
      percent: 33.3,
    });
    expect(res.body.frontDesk).toMatchObject({ inHouse: 1, guests: 2 });
    expect(res.body.money.collectedTodayCents).toBe(40000);
    expect(res.body.forecast).toHaveLength(14);
    expect(res.body.forecast[1]).toMatchObject({ booked: 2, sellable: 3 });
    expect(res.body.alerts.map((a: { kind: string }) => a.kind)).toEqual(
      expect.arrayContaining(['no-deposit', 'no-rate']),
    );
  });

  it('Limpieza recibe un tablero sin dinero ni huéspedes', async () => {
    const res = await as('limpieza').get('/api/dashboard').expect(200);
    expect(Object.keys(res.body).sort()).toEqual([
      'cleanedToday',
      'rooms',
      'today',
    ]);
    expect(res.body.rooms.byStatus.CLEANING).toBe(1);
  });
});
