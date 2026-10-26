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

// Hotel propio: 3 habitaciones.
describe('Tareas de limpieza (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let hotelId: string;
  let typeId: string;
  let guestId: string;
  const roomIds: string[] = [];
  const users: Record<string, string> = {};
  const tokens = { admin: '', recep: '', ana: '', beto: '' };
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
        data: { name: `Hotel Limpieza ${run}`, settings: { create: {} } },
      })
    ).id;
    const passwordHash = await hash(password);
    for (const [key, role] of [
      ['admin', 'ADMIN'],
      ['recep', 'RECEPTION'],
      ['ana', 'HOUSEKEEPING'],
      ['beto', 'HOUSEKEEPING'],
    ] as const) {
      const user = await prisma.user.create({
        data: {
          hotelId,
          role,
          passwordHash,
          name: key,
          email: `e2e-l-${key}-${run}@test.com`,
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
    for (const number of ['101', '102', '103']) {
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
        data: { hotelId, firstName: 'Leo', lastName: 'Limpio' },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.reservation.deleteMany({ where: { hotelId } });
    await prisma.cleaningTask.deleteMany({ where: { hotelId } });
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
      patch: (url: string, body: object) =>
        http.patch(url).set(auth).send(body),
    };
  };
  const active = async () =>
    (await as('admin').get('/api/cleaning-tasks').expect(200)).body as {
      id: string;
      kind: string;
      status: string;
      room: { number: string };
      assignedTo: { name: string } | null;
    }[];

  let stayId: string;

  it('el check-out crea la limpieza de salida', async () => {
    const walkIn = await as('recep')
      .post('/api/reservations/walk-in', {
        modality: 'NIGHTLY',
        arrivalDate: todayIn(TZ),
        departureDate: addDaysTo(todayIn(TZ), 1),
        adults: 1,
        guestId,
        roomTypeId: typeId,
        source: 'WALK_IN',
        roomId: roomIds[0],
      })
      .expect(201);
    stayId = walkIn.body.id;
    expect(await active()).toEqual([]);

    // Repaso a pedido con el huésped en casa.
    await as('ana')
      .post('/api/cleaning-tasks', { roomId: roomIds[0] })
      .expect(403);
    const repaso = await as('recep')
      .post('/api/cleaning-tasks', {
        roomId: roomIds[0],
        notes: 'Cambiar toallas',
        isPriority: true,
      })
      .expect(201);
    expect(repaso.body).toMatchObject({ kind: 'STAYOVER', status: 'PENDING' });
    const dup = await as('recep')
      .post('/api/cleaning-tasks', { roomId: roomIds[0] })
      .expect(409);
    expect(dup.body.message).toBe(
      'La habitación 101 ya tiene una limpieza pendiente',
    );
    const notOccupied = await as('recep')
      .post('/api/cleaning-tasks', { roomId: roomIds[1] })
      .expect(400);
    expect(notOccupied.body.message).toBe(
      'El repaso solo se pide para habitaciones ocupadas',
    );

    // Al salir, el repaso se reemplaza por la limpieza de salida.
    await as('admin')
      .post(`/api/reservations/${stayId}/check-out`, {
        balanceReason: 'Paga después',
      })
      .expect(201);
    const tasks = await active();
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      kind: 'DEPARTURE',
      room: { number: '101' },
    });
  });

  it('asignar, tomar, empezar y terminar; la habitación queda Disponible', async () => {
    const [task] = await active();
    await as('recep')
      .patch(`/api/cleaning-tasks/${task.id}`, { assignedToId: users.recep })
      .expect(400);
    await as('recep')
      .patch(`/api/cleaning-tasks/${task.id}`, { assignedToId: users.ana })
      .expect(200);

    // Beto no puede trabajar la de Ana.
    const other = await as('beto')
      .post(`/api/cleaning-tasks/${task.id}/start`)
      .expect(403);
    expect(other.body.message).toBe('Esta limpieza está asignada a ana');

    const started = await as('ana')
      .post(`/api/cleaning-tasks/${task.id}/start`)
      .expect(201);
    expect(started.body.status).toBe('IN_PROGRESS');
    expect(started.body.startedAt).toBeTruthy();

    const done = await as('ana')
      .post(`/api/cleaning-tasks/${task.id}/finish`)
      .expect(201);
    expect(done.body).toMatchObject({
      status: 'DONE',
      finishedBy: { name: 'ana' },
    });
    const room = await prisma.room.findUniqueOrThrow({
      where: { id: roomIds[0] },
    });
    expect(room).toMatchObject({
      status: 'AVAILABLE',
      lastCleanedById: users.ana,
    });
    await as('ana').post(`/api/cleaning-tasks/${task.id}/finish`).expect(400);

    const mine = await as('ana').get('/api/cleaning-tasks?scope=done');
    expect(mine.body).toHaveLength(1);
    expect(
      (await as('beto').get('/api/cleaning-tasks?scope=done')).body,
    ).toHaveLength(0);
  });

  it('desde el tablero: pasar a Limpieza crea la tarea y marcarla limpia la cierra', async () => {
    await as('recep')
      .patch(`/api/rooms/${roomIds[1]}/status`, { status: 'CLEANING' })
      .expect(200);
    let [task] = await active();
    expect(task).toMatchObject({ kind: 'DEPARTURE', room: { number: '102' } });

    // Beto la toma de la lista común.
    const taken = await as('beto')
      .post(`/api/cleaning-tasks/${task.id}/take`)
      .expect(201);
    expect(taken.body.assignedTo.name).toBe('beto');

    await as('beto')
      .patch(`/api/rooms/${roomIds[1]}/status`, { status: 'AVAILABLE' })
      .expect(200);
    expect(await active()).toEqual([]);
    const closed = await prisma.cleaningTask.findUniqueOrThrow({
      where: { id: task.id },
    });
    expect(closed).toMatchObject({
      status: 'DONE',
      finishedById: users.beto,
    });

    // Pasar de Limpieza a Mantenimiento cancela la tarea.
    await as('recep')
      .patch(`/api/rooms/${roomIds[2]}/status`, { status: 'CLEANING' })
      .expect(200);
    [task] = await active();
    await as('recep')
      .post(`/api/cleaning-tasks/${task.id}/cancel`, { reason: 'x' })
      .expect(400);
    await as('recep')
      .patch(`/api/rooms/${roomIds[2]}/status`, {
        status: 'MAINTENANCE',
        reason: 'Fuga',
        blockedUntil: addDaysTo(todayIn(TZ), 3),
      })
      .expect(200);
    expect(await active()).toEqual([]);
  });

  it('el reporte de limpieza usa el tiempo real de la tarea', async () => {
    const res = await as('admin')
      .get(`/api/reports/housekeeping?from=${todayIn(TZ)}&to=${todayIn(TZ)}`)
      .expect(200);
    const detail = res.body.sections.at(-1).rows;
    expect(detail).toHaveLength(2);
    expect(detail.map((r: { kind: string }) => r.kind)).toEqual([
      'Salida',
      'Salida',
    ]);
    // Ana empezó y terminó: tiene tiempo; la de Beto no se empezó.
    expect(detail[0]).toMatchObject({ user: 'ana', minutes: 0 });
    expect(detail[1]).toMatchObject({ user: 'beto', minutes: null });
  });
});
