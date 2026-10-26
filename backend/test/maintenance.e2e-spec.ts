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

// Hotel propio: 2 habitaciones.
describe('Tickets de mantenimiento (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let hotelId: string;
  let typeId: string;
  const roomIds: string[] = [];
  const tokens = { admin: '', recep: '', limpieza: '' };
  const run = randomUUID().slice(0, 8);
  const password = 'secreto123';
  const until = addDaysTo(todayIn(TZ), 2);

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
        data: { name: `Hotel Mantenimiento ${run}`, settings: { create: {} } },
      })
    ).id;
    const passwordHash = await hash(password);
    for (const [key, role] of [
      ['admin', 'ADMIN'],
      ['recep', 'RECEPTION'],
      ['limpieza', 'HOUSEKEEPING'],
    ] as const) {
      const user = await prisma.user.create({
        data: {
          hotelId,
          role,
          passwordHash,
          name: key,
          email: `e2e-m-${key}-${run}@test.com`,
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
    for (const number of ['201', '202']) {
      roomIds.push(
        (
          await prisma.room.create({
            data: { hotelId, roomTypeId: typeId, number, floor: 2 },
          })
        ).id,
      );
    }
  });

  afterAll(async () => {
    await prisma.maintenanceTicket.deleteMany({ where: { hotelId } });
    await prisma.cleaningTask.deleteMany({ where: { hotelId } });
    await prisma.roomStatusLog.deleteMany({ where: { hotelId } });
    await prisma.room.deleteMany({ where: { hotelId } });
    await prisma.roomType.deleteMany({ where: { hotelId } });
    await prisma.auditLog.deleteMany({ where: { hotelId } });
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
  const roomStatus = async (i: number) =>
    (await prisma.room.findUniqueOrThrow({ where: { id: roomIds[i] } })).status;

  it('limpieza reporta un problema, pero no puede bloquear ni ver la lista', async () => {
    const empty = await as('limpieza')
      .post('/api/maintenance-tickets', { description: 'x' })
      .expect(400);
    expect(empty.body.message).toBe('Elige la habitación o escribe el área');

    const created = await as('limpieza')
      .post('/api/maintenance-tickets', {
        roomId: roomIds[0],
        description: 'Foco fundido',
        priority: 'LOW',
      })
      .expect(201);
    expect(created.body).toMatchObject({
      status: 'OPEN',
      blocksRoom: false,
      reportedBy: { name: 'limpieza' },
    });
    await as('limpieza')
      .post('/api/maintenance-tickets', {
        roomId: roomIds[0],
        description: 'Fuga',
        blocksRoom: true,
        blockedUntil: until,
      })
      .expect(403);
    await as('limpieza').get('/api/maintenance-tickets').expect(403);
    expect(await roomStatus(0)).toBe('AVAILABLE');
  });

  let blockingId: string;

  it('un ticket que bloquea pasa la habitación a Mantenimiento', async () => {
    const noDate = await as('recep')
      .post('/api/maintenance-tickets', {
        roomId: roomIds[1],
        description: 'Fuga en el lavabo',
        priority: 'URGENT',
        blocksRoom: true,
      })
      .expect(400);
    expect(noDate.body.message).toBe(
      'Indica hasta qué fecha estará en Mantenimiento',
    );
    const res = await as('recep')
      .post('/api/maintenance-tickets', {
        roomId: roomIds[1],
        description: 'Fuga en el lavabo',
        priority: 'URGENT',
        blocksRoom: true,
        blockedUntil: until,
      })
      .expect(201);
    blockingId = res.body.id;
    expect(await roomStatus(1)).toBe('MAINTENANCE');

    // Área general, sin habitación.
    await as('admin')
      .post('/api/maintenance-tickets', {
        area: 'Lobby',
        description: 'Puerta de vidrio atorada',
      })
      .expect(201);

    const list = await as('recep').get('/api/maintenance-tickets').expect(200);
    expect(list.body).toHaveLength(3);
    expect(list.body[0]).toMatchObject({ priority: 'URGENT' });

    const dash = await as('admin').get('/api/dashboard').expect(200);
    expect(dash.body.alerts.map((a: { kind: string }) => a.kind)).toContain(
      'urgent-tickets',
    );
  });

  it('resolver registra quién lo arregló y manda la habitación a Limpieza', async () => {
    await as('recep')
      .post(`/api/maintenance-tickets/${blockingId}/start`)
      .expect(201);
    const bad = await as('recep')
      .post(`/api/maintenance-tickets/${blockingId}/resolve`, {})
      .expect(400);
    expect(bad.body.message).toEqual(
      expect.arrayContaining([
        'Describe la solución',
        'Indica quién lo arregló',
      ]),
    );
    const res = await as('recep')
      .post(`/api/maintenance-tickets/${blockingId}/resolve`, {
        resolution: 'Se cambió el empaque',
        fixedBy: 'Plomero Juan',
      })
      .expect(201);
    expect(res.body).toMatchObject({
      status: 'RESOLVED',
      fixedBy: 'Plomero Juan',
      resolvedBy: { name: 'recep' },
      roomReleased: true,
    });
    expect(await roomStatus(1)).toBe('CLEANING');
    // Y se creó su limpieza de salida.
    expect(
      await prisma.cleaningTask.count({
        where: { roomId: roomIds[1], status: 'PENDING' },
      }),
    ).toBe(1);
    await as('recep')
      .post(`/api/maintenance-tickets/${blockingId}/resolve`, {
        resolution: 'x',
        fixedBy: 'y',
      })
      .expect(400);
  });

  it('reporte de mantenimiento (solo ADMIN)', async () => {
    const range = `from=${todayIn(TZ)}&to=${todayIn(TZ)}`;
    await as('recep').get(`/api/reports/maintenance?${range}`).expect(403);
    const res = await as('admin')
      .get(`/api/reports/maintenance?${range}`)
      .expect(200);
    expect(res.body.summary.map((s: { value: number }) => s.value)).toEqual([
      3,
      1,
      1,
      expect.any(Number),
    ]);
    expect(res.body.sections[0].rows[0]).toMatchObject({
      name: 'Hab. 201',
      count: 1,
    });
  });
});
