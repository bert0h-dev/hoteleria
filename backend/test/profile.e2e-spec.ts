import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

// Crea su propio hotel y usuarios, y los borra al terminar.
describe('Mi perfil y datos del empleado (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let hotelId: string;

  const run = randomUUID().slice(0, 8);
  const adminEmail = `e2e-perfil-admin-${run}@test.com`;
  const staffEmail = `e2e-perfil-recep-${run}@test.com`;
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
      data: { name: `Hotel Perfil ${run}` },
    });
    hotelId = hotel.id;
    await prisma.user.createMany({
      data: [
        {
          hotelId,
          name: 'Admin',
          email: adminEmail,
          passwordHash,
          role: 'ADMIN',
        },
        {
          hotelId,
          name: 'Recepción',
          email: staffEmail,
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
  const login = (email: string, pass = password) =>
    http().post('/api/auth/login').send({ email, password: pass });

  it('el ADMIN registra teléfono, número de empleado y fecha de ingreso', async () => {
    const admin = await login(adminEmail).expect(200);
    const auth = { Authorization: `Bearer ${admin.body.accessToken}` };

    const created = await http()
      .post('/api/users')
      .set(auth)
      .send({
        name: 'Limpieza',
        email: `e2e-perfil-limp-${run}@test.com`,
        password,
        role: 'HOUSEKEEPING',
        phone: '998 123 4567',
        employeeNumber: 'emp-01',
        hireDate: '2024-03-15',
      })
      .expect(201);
    expect(created.body).toMatchObject({
      phone: '998 123 4567',
      employeeNumber: 'EMP-01',
    });
    expect(created.body.hireDate).toMatch(/^2024-03-15/);

    const dup = await http()
      .post('/api/users')
      .set(auth)
      .send({
        name: 'Otro',
        email: `e2e-perfil-otro-${run}@test.com`,
        password,
        role: 'RECEPTION',
        employeeNumber: 'EMP-01',
      })
      .expect(409);
    expect(dup.body.message).toBe(
      'Ya existe un usuario con ese número de empleado',
    );

    const bad = await http()
      .patch(`/api/users/${created.body.id}`)
      .set(auth)
      .send({ phone: 'abc', hireDate: '15/03/2024' })
      .expect(400);
    expect(bad.body.message).toEqual(
      expect.arrayContaining([
        'La fecha de ingreso debe tener el formato AAAA-MM-DD',
      ]),
    );
  });

  it('limpieza no puede tener permisos de cobro; al pasar a limpieza se le quitan', async () => {
    const admin = await login(adminEmail).expect(200);
    const auth = { Authorization: `Bearer ${admin.body.accessToken}` };
    const created = await http()
      .post('/api/users')
      .set(auth)
      .send({
        name: 'Futura Limpieza',
        email: `e2e-perfil-hk-${run}@test.com`,
        password,
        role: 'RECEPTION',
      })
      .expect(201);
    const id = created.body.id;

    // Como recepción sí puede tener permisos…
    await http()
      .patch(`/api/users/${id}`)
      .set(auth)
      .send({ canAuthorize: true, canDiscountUnlimited: true })
      .expect(200);
    // …pero al pasar a limpieza se le quitan solos.
    const toHousekeeping = await http()
      .patch(`/api/users/${id}`)
      .set(auth)
      .send({ role: 'HOUSEKEEPING' })
      .expect(200);
    expect(toHousekeeping.body).toMatchObject({
      role: 'HOUSEKEEPING',
      canAuthorize: false,
      canDiscountUnlimited: false,
    });

    const rejected = await http()
      .patch(`/api/users/${id}`)
      .set(auth)
      .send({ canAuthorize: true })
      .expect(400);
    expect(rejected.body.message).toBe(
      'El personal de limpieza no puede tener permisos de cobro ni autorizar',
    );
  });

  it('cada usuario edita su nombre y teléfono, pero no su rol ni su correo', async () => {
    const me = await login(staffEmail).expect(200);
    const auth = { Authorization: `Bearer ${me.body.accessToken}` };

    const res = await http()
      .patch('/api/auth/me')
      .set(auth)
      .send({ name: 'Ana Recepción', phone: '55 1234 5678' })
      .expect(200);
    expect(res.body).toMatchObject({
      name: 'Ana Recepción',
      phone: '55 1234 5678',
      role: 'RECEPTION',
    });

    const forbidden = await http()
      .patch('/api/auth/me')
      .set(auth)
      .send({ role: 'ADMIN', email: 'otro@test.com' })
      .expect(400);
    expect(forbidden.body.message).toEqual(
      expect.arrayContaining([
        'El campo «role» no está permitido',
        'El campo «email» no está permitido',
      ]),
    );
  });

  it('cambia su contraseña: exige la actual y cierra las demás sesiones', async () => {
    // Dos sesiones: "esta computadora" y "otra computadora".
    const current = await login(staffEmail).expect(200);
    const other = await login(staffEmail).expect(200);
    const auth = { Authorization: `Bearer ${current.body.accessToken}` };
    const currentCookie = current.get('Set-Cookie')!;
    const otherCookie = other.get('Set-Cookie')!;

    const wrong = await http()
      .patch('/api/auth/me/password')
      .set(auth)
      .set('Cookie', currentCookie)
      .send({ currentPassword: 'incorrecta', newPassword: 'nueva12345' })
      .expect(400);
    expect(wrong.body.message).toBe('La contraseña actual es incorrecta');

    const same = await http()
      .patch('/api/auth/me/password')
      .set(auth)
      .set('Cookie', currentCookie)
      .send({ currentPassword: password, newPassword: password })
      .expect(400);
    expect(same.body.message).toBe(
      'La nueva contraseña debe ser distinta a la actual',
    );

    await http()
      .patch('/api/auth/me/password')
      .set(auth)
      .set('Cookie', currentCookie)
      .send({ currentPassword: password, newPassword: 'nueva12345' })
      .expect(204);

    // La otra sesión quedó cerrada; la actual sigue funcionando.
    await http()
      .post('/api/auth/refresh')
      .set('Cookie', otherCookie)
      .expect(401);
    await http()
      .post('/api/auth/refresh')
      .set('Cookie', currentCookie)
      .expect(200);

    await login(staffEmail).expect(401);
    await login(staffEmail, 'nueva12345').expect(200);
  });
});
