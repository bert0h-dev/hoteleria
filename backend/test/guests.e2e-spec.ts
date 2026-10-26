import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

// Crea su propio hotel con usuarios de cada rol y lo borra al terminar.
describe('Huéspedes y datos fiscales (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let hotelId: string;
  const tokens = { admin: '', recep: '', limpieza: '' };

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

    const passwordHash = await hash(password);
    const hotel = await prisma.hotel.create({
      data: { name: `Hotel Huéspedes ${run}` },
    });
    hotelId = hotel.id;
    const roles = {
      admin: 'ADMIN',
      recep: 'RECEPTION',
      limpieza: 'HOUSEKEEPING',
    } as const;
    for (const [key, role] of Object.entries(roles)) {
      const user = await prisma.user.create({
        data: {
          hotelId,
          role,
          passwordHash,
          name: key,
          email: `e2e-g-${key}-${run}@test.com`,
        },
      });
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: user.email, password });
      tokens[key as keyof typeof tokens] = res.body.accessToken;
    }
  });

  afterAll(async () => {
    await prisma.guest.deleteMany({ where: { hotelId } }); // perfiles en cascada
    await prisma.user.deleteMany({ where: { hotelId } });
    await prisma.hotel.delete({ where: { id: hotelId } });
    await app.close();
  });

  const as = (who: keyof typeof tokens) => {
    const http = request(app.getHttpServer());
    const auth = { Authorization: `Bearer ${tokens[who]}` };
    return {
      get: (url: string) => http.get(url).set(auth),
      post: (url: string, body: object) => http.post(url).set(auth).send(body),
      patch: (url: string, body: object) =>
        http.patch(url).set(auth).send(body),
      delete: (url: string) => http.delete(url).set(auth),
    };
  };

  let guestId: string;

  it('limpieza no tiene acceso a huéspedes', async () => {
    await as('limpieza').get('/api/guests').expect(403);
  });

  it('exige al menos un dato de contacto y la identificación completa', async () => {
    const noContact = await as('recep')
      .post('/api/guests', { firstName: 'Ana', lastName: 'Ruiz' })
      .expect(400);
    expect(noContact.body.message).toBe(
      'Indica al menos un dato de contacto: teléfono o correo',
    );

    const halfDoc = await as('recep')
      .post('/api/guests', {
        firstName: 'Ana',
        lastName: 'Ruiz',
        phone: '9981234567',
        documentNumber: 'ABC123',
      })
      .expect(400);
    expect(halfDoc.body.message).toBe(
      'Indica el tipo y el número de identificación juntos',
    );
  });

  it('crea un huésped y no permite repetir la identificación', async () => {
    const res = await as('recep')
      .post('/api/guests', {
        firstName: 'María José',
        lastName: 'Núñez Pérez',
        phone: '(998) 123-4567',
        email: 'Maria@Correo.com',
        documentType: 'INE',
        documentNumber: 'nupm 850412',
        birthDate: '1985-04-12',
        nationality: 'mx',
        city: 'Guadalajara',
        state: 'Jalisco',
        country: 'MX',
        privacyAccepted: true,
      })
      .expect(201);
    guestId = res.body.id;
    expect(res.body).toMatchObject({
      email: 'maria@correo.com',
      documentNumber: 'NUPM850412',
      nationality: 'MX',
      birthDate: '1985-04-12',
      taxProfiles: [],
    });
    expect(res.body.privacyAcceptedAt).toEqual(expect.any(String));
    expect(res.body).not.toHaveProperty('searchText');

    const dup = await as('recep')
      .post('/api/guests', {
        firstName: 'Otra',
        lastName: 'Persona',
        email: 'otra@correo.com',
        documentType: 'INE',
        documentNumber: 'NUPM850412',
      })
      .expect(409);
    expect(dup.body.message).toBe(
      'Ya existe un huésped con esa identificación',
    );
  });

  it('busca sin importar acentos, mayúsculas ni formato del teléfono', async () => {
    for (const search of [
      'jose nunez',
      'NÚÑEZ',
      '998 123 4567',
      'nupm850412',
    ]) {
      const res = await as('recep')
        .get(`/api/guests?search=${encodeURIComponent(search)}`)
        .expect(200);
      expect(res.body.total).toBe(1);
      expect(res.body.data[0].id).toBe(guestId);
    }
    const none = await as('recep').get('/api/guests?search=zzz').expect(200);
    expect(none.body.total).toBe(0);
  });

  it('avisa de posibles duplicados por teléfono o correo', async () => {
    const res = await as('recep')
      .get('/api/guests/duplicates?phone=998-123-4567&email=MARIA@correo.com')
      .expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].reasons).toEqual(['phone', 'email']);

    const excluded = await as('recep')
      .get(`/api/guests/duplicates?phone=9981234567&excludeId=${guestId}`)
      .expect(200);
    expect(excluded.body).toHaveLength(0);
  });

  it('solo el ADMIN bloquea, y con motivo', async () => {
    await as('recep')
      .patch(`/api/guests/${guestId}/block`, { isBlocked: true, reason: 'x' })
      .expect(403);
    const noReason = await as('admin')
      .patch(`/api/guests/${guestId}/block`, { isBlocked: true })
      .expect(400);
    expect(noReason.body.message).toContain('Indica el motivo del bloqueo');

    const blocked = await as('admin')
      .patch(`/api/guests/${guestId}/block`, {
        isBlocked: true,
        reason: 'Daños a la habitación',
      })
      .expect(200);
    expect(blocked.body).toMatchObject({
      isBlocked: true,
      blockedReason: 'Daños a la habitación',
    });
    const list = await as('recep').get('/api/guests?blocked=true').expect(200);
    expect(list.body.total).toBe(1);

    const unblocked = await as('admin')
      .patch(`/api/guests/${guestId}/block`, { isBlocked: false })
      .expect(200);
    expect(unblocked.body.blockedReason).toBeNull();
  });

  it('valida los datos fiscales según CFDI 4.0', async () => {
    const badRfc = await as('recep')
      .post(`/api/guests/${guestId}/tax-profiles`, {
        rfc: 'NUPM851312XX1',
        legalName: 'María José Núñez',
        taxRegime: '612',
        zipCode: '44100',
      })
      .expect(400);
    expect(badRfc.body.message[0]).toMatch(/El RFC no es válido/);

    const badRegime = await as('recep')
      .post(`/api/guests/${guestId}/tax-profiles`, {
        rfc: 'NUPM850412AB1',
        legalName: 'María José Núñez',
        taxRegime: '601',
        zipCode: '44100',
      })
      .expect(400);
    expect(badRegime.body.message).toEqual([
      'El régimen 601 no aplica a una persona física',
    ]);
  });

  it('administra varios perfiles fiscales con uno predeterminado', async () => {
    const first = await as('recep')
      .post(`/api/guests/${guestId}/tax-profiles`, {
        rfc: 'nupm-850412-ab1',
        legalName: 'maría josé núñez pérez',
        taxRegime: '612',
        zipCode: '44100',
      })
      .expect(201);
    expect(first.body.taxProfiles).toHaveLength(1);
    expect(first.body.taxProfiles[0]).toMatchObject({
      rfc: 'NUPM850412AB1',
      legalName: 'MARÍA JOSÉ NÚÑEZ PÉREZ',
      cfdiUse: 'G03',
      isDefault: true,
    });

    const second = await as('recep')
      .post(`/api/guests/${guestId}/tax-profiles`, {
        rfc: 'EDE010101AB1',
        legalName: 'Empresa Demo',
        taxRegime: '601',
        zipCode: '77500',
        invoiceEmail: 'facturas@demo.com',
        isDefault: true,
      })
      .expect(201);
    const byRfc = Object.fromEntries(
      second.body.taxProfiles.map((p: { rfc: string; isDefault: boolean }) => [
        p.rfc,
        p.isDefault,
      ]),
    );
    expect(byRfc).toEqual({ EDE010101AB1: true, NUPM850412AB1: false });

    await as('recep')
      .post(`/api/guests/${guestId}/tax-profiles`, {
        rfc: 'EDE010101AB1',
        legalName: 'Empresa Demo',
        taxRegime: '601',
        zipCode: '77500',
      })
      .expect(409);

    // Se puede buscar por RFC.
    const found = await as('recep')
      .get('/api/guests?search=EDE010101AB1')
      .expect(200);
    expect(found.body.data[0].id).toBe(guestId);

    // Al borrar el predeterminado, el otro toma su lugar.
    const companyId = second.body.taxProfiles.find(
      (p: { rfc: string }) => p.rfc === 'EDE010101AB1',
    ).id;
    const afterDelete = await as('recep')
      .delete(`/api/guests/${guestId}/tax-profiles/${companyId}`)
      .expect(200);
    expect(afterDelete.body.taxProfiles).toHaveLength(1);
    expect(afterDelete.body.taxProfiles[0].isDefault).toBe(true);
  });

  it('expone los catálogos del SAT', async () => {
    const res = await as('recep').get('/api/catalogs/sat').expect(200);
    expect(res.body.taxRegimes).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: '612' })]),
    );
    expect(res.body.cfdiUses.map((u: { code: string }) => u.code)).toContain(
      'G03',
    );
  });
});
