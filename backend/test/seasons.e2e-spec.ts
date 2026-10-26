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

/** Siguiente fecha (a partir de dentro de 30 días) que cae en el día indicado. */
function nextWeekday(dow: number, minDays = 30): string {
  let date = addDaysTo(todayIn(TZ), minDays);
  while (new Date(`${date}T12:00:00Z`).getUTCDay() !== dow) {
    date = addDaysTo(date, 1);
  }
  return date;
}

describe('Temporadas y días de la semana (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let hotelId: string;
  let typeId: string;
  let guestId: string;
  const tokens = { admin: '', recep: '' };
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
      data: { name: `Hotel Temporadas ${run}`, settings: { create: {} } },
    });
    hotelId = hotel.id;
    const passwordHash = await hash(password);
    for (const [key, role] of [
      ['admin', 'ADMIN'],
      ['recep', 'RECEPTION'],
    ] as const) {
      const user = await prisma.user.create({
        data: {
          hotelId,
          role,
          passwordHash,
          name: key,
          email: `e2e-s-${key}-${run}@test.com`,
        },
      });
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: user.email, password });
      tokens[key] = res.body.accessToken;
    }
    const type = await prisma.roomType.create({
      data: {
        hotelId,
        name: 'Doble',
        maxAdults: 4,
        nightlyRate: 1000,
        extraAdultRate: 250,
      },
    });
    typeId = type.id;
    await prisma.room.create({
      data: { hotelId, roomTypeId: typeId, number: '101', floor: 1 },
    });
    const guest = await prisma.guest.create({
      data: {
        hotelId,
        firstName: 'Ana',
        lastName: 'Temporada',
        phone: '9980000000',
      },
    });
    guestId = guest.id;
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
      delete: (url: string) => http.delete(url).set(auth),
    };
  };

  const quoteNights = async (arrival: string, nights: number, adults = 2) => {
    const res = await as('recep')
      .post('/api/reservations/quote', {
        modality: 'NIGHTLY',
        arrivalDate: arrival,
        departureDate: addDaysTo(arrival, nights),
        adults,
      })
      .expect(201);
    return res.body.options[0];
  };

  const thursday = nextWeekday(4);

  it('solo el ADMIN administra temporadas y se validan las fechas', async () => {
    await as('recep')
      .post('/api/rate-periods', {
        name: 'X',
        startDate: thursday,
        endDate: thursday,
        adjustmentPercent: 10,
      })
      .expect(403);
    const bad = await as('admin')
      .post('/api/rate-periods', {
        name: 'Al revés',
        startDate: addDaysTo(thursday, 5),
        endDate: thursday,
        adjustmentPercent: 10,
      })
      .expect(400);
    expect(bad.body.message).toBe(
      'La fecha de fin no puede ser anterior a la de inicio',
    );
  });

  it('aplica el ajuste de fin de semana noche por noche', async () => {
    await as('admin')
      .patch('/api/hotel/settings', {
        weekdayAdjustDays: [5, 6],
        weekdayAdjustPercent: 15,
      })
      .expect(200);
    // Jue 1000 + vie 1150 + sáb 1150; adulto extra fijo: 250 × 3
    const option = await quoteNights(thursday, 3, 3);
    expect(option.quote).toMatchObject({
      baseAmount: 3300,
      extrasAmount: 750,
      totalAmount: 4050,
    });
    expect(
      option.quote.detail.nights.map((n: { source: string }) => n.source),
    ).toEqual(['base', 'weekday', 'weekday']);
  });

  it('una reserva existente conserva su precio aunque se cree una temporada', async () => {
    const created = await as('recep')
      .post('/api/reservations', {
        modality: 'NIGHTLY',
        arrivalDate: thursday,
        departureDate: addDaysTo(thursday, 1),
        adults: 2,
        guestId,
        roomTypeId: typeId,
        source: 'PHONE',
      })
      .expect(201);
    expect(created.body.totalAmount).toBe(1000);

    const season = await as('admin')
      .post('/api/rate-periods', {
        name: 'Puente',
        startDate: thursday,
        endDate: addDaysTo(thursday, 3),
        adjustmentPercent: 30,
        color: 'rose',
      })
      .expect(201);
    expect(season.body).toMatchObject({
      startDate: thursday,
      endDate: addDaysTo(thursday, 3),
    });

    const again = await as('recep')
      .get(`/api/reservations/${created.body.id}`)
      .expect(200);
    expect(again.body.totalAmount).toBe(1000);
  });

  it('en temporada no se suma el fin de semana', async () => {
    // Jue, vie y sáb dentro de "Puente": 1300 × 3 (sin +15 % del fin de semana)
    const option = await quoteNights(addDaysTo(thursday, 1), 2);
    expect(option.quote.baseAmount).toBe(2600);
    expect(option.quote.detail.nights[0]).toMatchObject({
      source: 'season',
      seasonName: 'Puente',
    });
  });

  it('el calendario incluye temporadas y la regla de días', async () => {
    const res = await as('recep')
      .get(`/api/reservations/calendar?from=${thursday}&days=7`)
      .expect(200);
    expect(res.body.seasons).toEqual([
      expect.objectContaining({ name: 'Puente', color: 'rose' }),
    ]);
    expect(res.body.weekday).toEqual({ days: [5, 6], percent: 15 });
  });

  it('una temporada desactivada o borrada deja de aplicar', async () => {
    const list = await as('recep').get('/api/rate-periods').expect(200);
    const id = list.body[0].id;
    await as('admin')
      .patch(`/api/rate-periods/${id}`, { isActive: false })
      .expect(200);
    expect(
      (await quoteNights(addDaysTo(thursday, 1), 1)).quote.baseAmount,
    ).toBe(1150);
    await as('admin').delete(`/api/rate-periods/${id}`).expect(204);
    expect((await as('recep').get('/api/rate-periods')).body).toEqual([]);
  });
});
