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

/** Hora local actual del hotel (HH:mm). */
function nowTime(): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date());
}

// Hotel propio: 2 Dobles (101, 102) y 1 Suite (201).
describe('Check-in, estancia y check-out (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let hotelId: string;
  let dobleId: string;
  let suiteId: string;
  let guestId: string;
  const rooms: Record<string, string> = {};
  let token = '';
  const run = randomUUID().slice(0, 8);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const hotel = await prisma.hotel.create({
      data: { name: `Hotel Estancias ${run}`, settings: { create: {} } },
    });
    hotelId = hotel.id;
    const user = await prisma.user.create({
      data: {
        hotelId,
        role: 'RECEPTION',
        // Puede autorizar su propia salida con saldo pendiente.
        canAuthorize: true,
        name: 'Recepción',
        email: `e2e-st-${run}@test.com`,
        passwordHash: await hash('secreto123'),
      },
    });
    token = (
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: user.email, password: 'secreto123' })
    ).body.accessToken;

    dobleId = (
      await prisma.roomType.create({
        data: { hotelId, name: 'Doble', maxAdults: 4, nightlyRate: 1000 },
      })
    ).id;
    suiteId = (
      await prisma.roomType.create({
        data: { hotelId, name: 'Suite', maxAdults: 4, nightlyRate: 2500 },
      })
    ).id;
    for (const [number, typeId] of [
      ['101', dobleId],
      ['102', dobleId],
      ['201', suiteId],
    ]) {
      rooms[number] = (
        await prisma.room.create({
          data: { hotelId, roomTypeId: typeId, number, floor: +number[0] },
        })
      ).id;
    }
    guestId = (
      await prisma.guest.create({
        data: {
          hotelId,
          firstName: 'Ana',
          lastName: 'Estancia',
          phone: '9981234567',
        },
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

  const http = () => request(app.getHttpServer());
  const auth = () => ({ Authorization: `Bearer ${token}` });
  const post = (url: string, body: object = {}) =>
    http().post(url).set(auth()).send(body);
  const get = (url: string) => http().get(url).set(auth());

  /** Reserva por día que empieza ahora (sin cargo de entrada anticipada). */
  const dailyNow = (extra: object = {}) =>
    post('/api/reservations', {
      modality: 'DAILY',
      arrivalDate: todayIn(TZ),
      arrivalTime: nowTime(),
      units: 1,
      adults: 2,
      guestId,
      roomTypeId: dobleId,
      source: 'WALK_IN',
      ...extra,
    }).expect(201);

  let stayId: string;

  it('lista las habitaciones asignables, incluidas las mejoras', async () => {
    stayId = (await dailyNow()).body.id;
    const res = await get(`/api/reservations/${stayId}/available-rooms`).expect(
      200,
    );
    const byNumber = Object.fromEntries(
      res.body.map((r: { number: string }) => [r.number, r]),
    );
    expect(byNumber['101']).toMatchObject({ upgrade: false, assignable: true });
    expect(byNumber['201']).toMatchObject({ upgrade: true, assignable: true });
  });

  it('la mejora de categoría exige motivo y conserva el precio', async () => {
    const noReason = await post(`/api/reservations/${stayId}/check-in`, {
      roomId: rooms['201'],
    }).expect(400);
    expect(noReason.body.message).toMatch(/indica el motivo de la mejora/);

    const res = await post(`/api/reservations/${stayId}/check-in`, {
      roomId: rooms['201'],
      reason: 'No había Dobles limpias',
    }).expect(201);
    expect(res.body).toMatchObject({
      status: 'CHECKED_IN',
      room: { number: '201' },
      roomType: { name: 'Suite' },
      bookedRoomType: { name: 'Doble' },
      upgradeReason: 'No había Dobles limpias',
      totalAmount: 1200, // precio de la Doble por día
      checkedInBy: { name: 'Recepción' },
    });
  });

  it('la habitación queda Ocupada y no se puede cambiar a mano', async () => {
    const room = await prisma.room.findUniqueOrThrow({
      where: { id: rooms['201'] },
    });
    expect(room.status).toBe('OCCUPIED');

    const manual = await http()
      .patch(`/api/rooms/${rooms['201']}/status`)
      .set(auth())
      .send({ status: 'CLEANING' })
      .expect(400);
    expect(manual.body.message).toMatch(/huésped en casa/);

    const toOccupied = await http()
      .patch(`/api/rooms/${rooms['101']}/status`)
      .set(auth())
      .send({ status: 'OCCUPIED' })
      .expect(400);
    expect(toOccupied.body.message).toMatch(/check-in/);

    const list = await get('/api/rooms').expect(200);
    const suite = list.body.find((r: { number: string }) => r.number === '201');
    expect(suite.currentStay.guest.firstName).toBe('Ana');
  });

  it('no permite asignar una habitación ocupada ni hacer check-in antes del día', async () => {
    const other = (await dailyNow()).body.id;
    const busy = await post(`/api/reservations/${other}/check-in`, {
      roomId: rooms['201'],
      reason: 'x',
    }).expect(400);
    expect(busy.body.message).toBe(
      'La habitación 201 no está disponible (Ocupada)',
    );

    const future = await post('/api/reservations', {
      modality: 'NIGHTLY',
      arrivalDate: addDaysTo(todayIn(TZ), 3),
      departureDate: addDaysTo(todayIn(TZ), 4),
      adults: 2,
      guestId,
      roomTypeId: dobleId,
      source: 'PHONE',
    }).expect(201);
    const early = await post(`/api/reservations/${future.body.id}/check-in`, {
      roomId: rooms['101'],
    }).expect(400);
    expect(early.body.message).toMatch(/Aún no es el día de llegada/);
  });

  it('cambia de habitación: la anterior pasa a Limpieza', async () => {
    const res = await post(`/api/reservations/${stayId}/move`, {
      roomId: rooms['102'],
      reason: 'Se liberó una Doble',
    }).expect(201);
    expect(res.body.room.number).toBe('102');
    const old = await prisma.room.findUniqueOrThrow({
      where: { id: rooms['201'] },
    });
    expect(old.status).toBe('CLEANING');
  });

  it('extiende la estancia y recalcula el precio', async () => {
    const before = await get(`/api/reservations/${stayId}`).expect(200);
    const res = await post(`/api/reservations/${stayId}/extend`, {
      units: 2,
    }).expect(201);
    expect(res.body.units).toBe(2);
    expect(new Date(res.body.checkOut).getTime()).toBeGreaterThan(
      new Date(before.body.checkOut).getTime(),
    );
    // Ahora ocupa inventario de Suite (por la mejora), pero conserva su
    // tarifa congelada de Doble: 2 días × 1200.
    // Con mejora de categoría se cobra la tarifa congelada de la Doble
    // (2 días × 1200), no la de la Suite.
    expect(res.body.totalAmount).toBe(2400);
    expect(before.body.totalAmount).toBe(1200);
  });

  it('check-out tardío: sugiere el cargo y manda la habitación a Limpieza', async () => {
    // Simula que la salida era hace 2 h 55 min (se cobran 3 h).
    await prisma.reservation.update({
      where: { id: stayId },
      data: { checkOut: new Date(Date.now() - (3 * 60 - 5) * 60_000) },
    });
    const res = await post(`/api/reservations/${stayId}/check-out`, {
      balanceReason: 'Paga al día siguiente',
    }).expect(201);
    expect(res.body.status).toBe('CHECKED_OUT');
    expect(res.body.charges).toEqual([
      expect.objectContaining({
        kind: 'LATE_CHECK_OUT',
        status: 'SUGGESTED',
        hours: 3,
        amount: 3 * 150, // 3 h × 15 % de 1000
      }),
    ]);
    const room = await prisma.room.findUniqueOrThrow({
      where: { id: rooms['102'] },
    });
    expect(room.status).toBe('CLEANING');
  });

  it('ajusta las personas al llegar y durante la estancia', async () => {
    // La Doble cobra $250 por adulto extra (incluye 2).
    await prisma.roomType.update({
      where: { id: dobleId },
      data: { extraAdultRate: 250 },
    });
    await prisma.room.update({
      where: { id: rooms['201'] },
      data: { status: 'AVAILABLE' },
    });
    const id = (await dailyNow()).body.id; // reservada para 2 adultos

    // Llegan 3: se ajusta en el check-in (mejora a Suite, cargos de la Doble).
    const checkIn = await post(`/api/reservations/${id}/check-in`, {
      roomId: rooms['201'],
      reason: 'Familia más grande',
      adults: 3,
      children: 0,
    }).expect(201);
    expect(checkIn.body).toMatchObject({
      adults: 3,
      extrasAmount: 250,
      totalAmount: 1450,
    });

    // Durante la estancia llega una persona más: se recalcula todo.
    const more = await post(`/api/reservations/${id}/guests`, {
      adults: 4,
      children: 0,
    }).expect(201);
    expect(more.body).toMatchObject({ adults: 4, totalAmount: 1700 });

    const tooMany = await post(`/api/reservations/${id}/guests`, {
      adults: 5,
      children: 0,
    }).expect(400);
    expect(tooMany.body.message).toBe(
      '«Suite» admite hasta 4 adultos y 0 niños',
    );

    const same = await post(`/api/reservations/${id}/guests`, {
      adults: 4,
      children: 0,
    }).expect(400);
    expect(same.body.message).toBe('La cantidad de personas no cambió');

    await post(`/api/reservations/${id}/check-out`, {
      balanceReason: 'Prueba',
    }).expect(201);
  });

  it('llegada sin reserva: crea la reserva y hace el check-in', async () => {
    const res = await post('/api/reservations/walk-in', {
      modality: 'HOURLY',
      arrivalDate: todayIn(TZ),
      arrivalTime: nowTime(),
      units: 4,
      adults: 2,
      guestId,
      roomTypeId: dobleId,
      source: 'WALK_IN',
      roomId: rooms['101'],
    }).expect(201);
    expect(res.body).toMatchObject({
      status: 'CHECKED_IN',
      room: { number: '101' },
      totalAmount: 600,
    });

    const desk = await get('/api/reservations/front-desk').expect(200);
    expect(desk.body.inHouse.map((r: { id: string }) => r.id)).toContain(
      res.body.id,
    );
  });
});
