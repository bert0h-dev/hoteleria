import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import ExcelJS from 'exceljs';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { addDaysTo, todayIn } from './../src/common/time/hotel-date.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

const TZ = 'America/Mexico_City';

// Hotel propio: 2 habitaciones Doble a $1,000.
describe('Reportes (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let hotelId: string;
  let typeId: string;
  let guestId: string;
  const roomIds: string[] = [];
  const users: Record<string, string> = {};
  const tokens = { admin: '', recep: '', limpieza: '', limpieza2: '' };
  const run = randomUUID().slice(0, 8);
  const password = 'secreto123';
  const today = todayIn(TZ);
  const range = `from=${today}&to=${addDaysTo(today, 1)}`;

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
        data: { name: `Hotel Reportes ${run}`, settings: { create: {} } },
      })
    ).id;
    const passwordHash = await hash(password);
    for (const [key, role] of [
      ['admin', 'ADMIN'],
      ['recep', 'RECEPTION'],
      ['limpieza', 'HOUSEKEEPING'],
      ['limpieza2', 'HOUSEKEEPING'],
    ] as const) {
      const user = await prisma.user.create({
        data: {
          hotelId,
          role,
          passwordHash,
          name: key,
          email: `e2e-r-${key}-${run}@test.com`,
          canAuthorize: role === 'ADMIN',
        },
      });
      users[key] = user.id;
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
      roomIds.push(
        (
          await prisma.room.create({
            data: { hotelId, roomTypeId: typeId, number, floor: 1 },
          })
        ).id,
      );
    }
    guestId = (
      await prisma.guest.create({
        data: { hotelId, firstName: 'Rita', lastName: 'Reportes' },
      })
    ).id;

    // Recepción renta la 101 dos noches, cobra $500 y da $100 de descuento.
    const walkIn = await as('recep')
      .post('/api/reservations/walk-in', {
        modality: 'NIGHTLY',
        arrivalDate: today,
        departureDate: addDaysTo(today, 2),
        adults: 2,
        guestId,
        roomTypeId: typeId,
        source: 'WALK_IN',
        roomId: roomIds[0],
      })
      .expect(201);
    await as('recep').post('/api/cash-shifts', {}).expect(201);
    await as('recep')
      .post(`/api/reservations/${walkIn.body.id}/payments`, {
        method: 'CASH',
        amount: 500,
      })
      .expect(201);
    await as('recep')
      .post(`/api/reservations/${walkIn.body.id}/folio/discounts`, {
        amount: 100,
        reason: 'Cliente frecuente',
      })
      .expect(201);

    // Limpiezas: la 102 pasó a Limpieza hace 45 min y "limpieza" la limpió.
    const now = Date.now();
    await prisma.roomStatusLog.createMany({
      data: [
        {
          hotelId,
          roomId: roomIds[1],
          fromStatus: 'AVAILABLE',
          toStatus: 'CLEANING',
          changedById: users.admin,
          createdAt: new Date(now - 45 * 60_000),
        },
        {
          hotelId,
          roomId: roomIds[1],
          fromStatus: 'CLEANING',
          toStatus: 'AVAILABLE',
          changedById: users.limpieza,
          cleanedById: users.limpieza,
          cleanedAt: new Date(now),
          createdAt: new Date(now),
        },
      ],
    });
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

  it('valida el rango y el tipo de reporte', async () => {
    await as('admin').get(`/api/reports/nada?${range}`).expect(404);
    const bad = await as('admin')
      .get(`/api/reports/occupancy?from=${today}&to=2020-01-01`)
      .expect(400);
    expect(bad.body.message).toBe(
      'La fecha final no puede ser anterior a la inicial',
    );
    const missing = await as('admin').get('/api/reports/occupancy').expect(400);
    expect(missing.body.message).toContain(
      'La fecha inicial debe tener el formato AAAA-MM-DD',
    );
  });

  it('ocupación e ingresos devengados', async () => {
    const occ = await as('admin')
      .get(`/api/reports/occupancy?${range}`)
      .expect(200);
    const days = occ.body.sections[0];
    expect(days.rows.map((r: { sold: number }) => r.sold)).toEqual([1, 1]);
    expect(days.totals).toMatchObject({
      available: 4,
      sold: 2,
      occupancy: 50,
      revenue: 200000,
      adr: 100000,
    });

    const rev = await as('admin')
      .get(`/api/reports/revenue?${range}`)
      .expect(200);
    expect(rev.body.sections[0].totals).toMatchObject({
      lodging: 200000,
      discounts: 10000,
      net: 190000,
    });
    expect(rev.body.sections[2].rows[0]).toMatchObject({ name: 'Mostrador' });
  });

  it('cobros y descuentos', async () => {
    const pay = await as('admin')
      .get(`/api/reports/payments?${range}`)
      .expect(200);
    expect(pay.body.summary[0]).toMatchObject({ value: 50000 });
    expect(pay.body.sections[1].rows[0]).toMatchObject({
      name: 'recep',
      payments: 1,
      mxn: 50000,
    });

    const disc = await as('admin')
      .get(`/api/reports/discounts?${range}`)
      .expect(200);
    expect(disc.body.sections[1].rows[0]).toMatchObject({
      type: 'Descuento',
      amount: 10000,
      user: 'recep',
      reason: 'Cliente frecuente',
    });
  });

  it('rentas por recepcionista: recepción sí, limpieza no', async () => {
    await as('recep').get(`/api/reports/payments?${range}`).expect(403);
    await as('limpieza').get(`/api/reports/rentals?${range}`).expect(403);
    const res = await as('recep')
      .get(`/api/reports/rentals?${range}`)
      .expect(200);
    expect(res.body.sections[0].rows).toEqual([
      expect.objectContaining({
        name: 'recep',
        rentals: 1,
        walkIns: 1,
        nights: 2,
        amount: 200000,
      }),
    ]);
  });

  it('limpieza: cada quien ve solo las suyas; recepción ve todas', async () => {
    const mine = await as('limpieza')
      .get(`/api/reports/housekeeping?${range}`)
      .expect(200);
    expect(mine.body.title).toBe('Mis limpiezas');
    expect(mine.body.summary[0].value).toBe(1);
    expect(mine.body.sections.at(-1).rows[0]).toMatchObject({
      room: '102',
      minutes: 45,
    });

    const other = await as('limpieza2')
      .get(`/api/reports/housekeeping?${range}`)
      .expect(200);
    expect(other.body.summary[0].value).toBe(0);

    const all = await as('recep')
      .get(`/api/reports/housekeeping?${range}`)
      .expect(200);
    expect(all.body.sections[0].rows[0]).toMatchObject({
      name: 'limpieza',
      count: 1,
      avgMinutes: 45,
    });
  });

  it('exporta a Excel con una hoja por sección', async () => {
    const res = await as('admin')
      .get(`/api/reports/revenue/xlsx?${range}`)
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body as Buffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Resumen',
      'Por día',
      'Por tipo de habitación',
      'Por origen de la reserva',
    ]);
    const sheet = wb.getWorksheet('Por día')!;
    expect(sheet.getCell('A1').value).toBe(`Hotel Reportes ${run}`);
    expect(sheet.getRow(4).getCell(2).value).toBe('Hospedaje');
    // Fila de totales: hospedaje en pesos.
    expect(sheet.getRow(7).getCell(2).value).toBe(2000);
  });
});
