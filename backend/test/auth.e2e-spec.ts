import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

// Crea su propio hotel y usuarios con correos únicos, y los borra al terminar,
// para no interferir con los datos existentes de la base.
describe('Auth y usuarios (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let hotelId: string;

  const run = randomUUID().slice(0, 8);
  const adminEmail = `e2e-admin-${run}@test.com`;
  const receptionEmail = `e2e-recep-${run}@test.com`;
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
      data: { name: `Hotel E2E ${run}` },
    });
    hotelId = hotel.id;
    await prisma.user.createMany({
      data: [
        {
          hotelId,
          name: 'Admin E2E',
          email: adminEmail,
          passwordHash,
          role: 'ADMIN',
        },
        {
          hotelId,
          name: 'Recepción E2E',
          email: receptionEmail,
          passwordHash,
          role: 'RECEPTION',
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { hotelId } });
    await prisma.cashShift.deleteMany({ where: { hotelId } });
    await prisma.user.deleteMany({ where: { hotelId } });
    await prisma.hotel.delete({ where: { id: hotelId } });
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const login = (email: string) =>
    http().post('/api/auth/login').send({ email, password });

  it('rechaza rutas protegidas sin token', () =>
    http().get('/api/auth/me').expect(401));

  it('rechaza credenciales incorrectas', () =>
    http()
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'incorrecta' })
      .expect(401));

  it('login → /me → refresh → logout', async () => {
    const res = await login(adminEmail).expect(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user).not.toHaveProperty('passwordHash');
    const cookie = res.get('Set-Cookie')!;
    expect(cookie[0]).toMatch(/refresh_token=.+HttpOnly/i);

    const me = await http()
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${res.body.accessToken}`)
      .expect(200);
    expect(me.body.email).toBe(adminEmail);

    const refreshed = await http()
      .post('/api/auth/refresh')
      .set('Cookie', cookie)
      .expect(200);
    const newCookie = refreshed.get('Set-Cookie')!;

    // El refresh token anterior ya no sirve (rotación).
    await http().post('/api/auth/refresh').set('Cookie', cookie).expect(401);

    await http().post('/api/auth/logout').set('Cookie', newCookie).expect(204);
    await http().post('/api/auth/refresh').set('Cookie', newCookie).expect(401);
  });

  it('solo un ADMIN puede gestionar usuarios', async () => {
    const recep = await login(receptionEmail).expect(200);
    await http()
      .get('/api/users')
      .set('Authorization', `Bearer ${recep.body.accessToken}`)
      .expect(403);

    const admin = await login(adminEmail).expect(200);
    const list = await http()
      .get('/api/users')
      .set('Authorization', `Bearer ${admin.body.accessToken}`)
      .expect(200);
    expect(list.body.total).toBe(2);
    expect(
      list.body.data.every((u: { hotelId: string }) => u.hotelId === hotelId),
    ).toBe(true);
  });

  it('crea un usuario y rechaza correos duplicados', async () => {
    const admin = await login(adminEmail).expect(200);
    const auth = { Authorization: `Bearer ${admin.body.accessToken}` };
    const nuevo = {
      name: 'Limpieza E2E',
      email: `e2e-limpieza-${run}@test.com`,
      password,
      role: 'HOUSEKEEPING',
    };

    const created = await http()
      .post('/api/users')
      .set(auth)
      .send(nuevo)
      .expect(201);
    expect(created.body.hotelId).toBe(hotelId);

    await http().post('/api/users').set(auth).send(nuevo).expect(409);
  });
});
