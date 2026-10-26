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

function nowTime(): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date());
}

// Hotel propio: Doble a $1,000 la noche (2 habitaciones).
describe('Cobros: folio, descuentos, PIN, dólares y check-out (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let hotelId: string;
  let typeId: string;
  let guestId: string;
  let adminId: string;
  const roomIds: string[] = [];
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

    hotelId = (
      await prisma.hotel.create({
        data: { name: `Hotel Cobros ${run}`, settings: { create: {} } },
      })
    ).id;
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
          name: key === 'admin' ? 'Gerente' : 'Recepción',
          email: `e2e-b-${key}-${run}@test.com`,
          canAuthorize: role === 'ADMIN',
        },
      });
      if (role === 'ADMIN') adminId = user.id;
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
        data: {
          hotelId,
          firstName: 'Ana',
          lastName: 'Cobros',
          phone: '9980001111',
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
    await prisma.chargeConcept.deleteMany({ where: { hotelId } });
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
      patch: (url: string, body: object) =>
        http.patch(url).set(auth).send(body),
    };
  };

  let resId: string;

  it('folio inicial: el hospedaje es el saldo', async () => {
    // 3 noches × $1,000 dentro de un mes.
    const created = await as('recep')
      .post('/api/reservations', {
        modality: 'NIGHTLY',
        arrivalDate: addDaysTo(todayIn(TZ), 30),
        departureDate: addDaysTo(todayIn(TZ), 33),
        adults: 2,
        guestId,
        roomTypeId: typeId,
        source: 'PHONE',
        requiresDeposit: true,
      })
      .expect(201);
    resId = created.body.id;
    const folio = await as('recep')
      .get(`/api/reservations/${resId}/folio`)
      .expect(200);
    expect(folio.body.totals).toMatchObject({
      grossCents: 300000,
      balanceCents: 300000,
    });
    expect(folio.body.depositPaid).toBe(false);
    expect(folio.body.discountCap).toEqual({
      percent: 10,
      capCents: 30000,
      usedCents: 0,
    });
  });

  it('agrega cargos del catálogo con cantidad', async () => {
    await as('recep')
      .post('/api/charge-concepts', { name: 'Agua', price: 35 })
      .expect(403);
    const concept = await as('admin')
      .post('/api/charge-concepts', {
        name: 'Agua',
        category: 'Minibar',
        price: 35,
      })
      .expect(201);
    const folio = await as('recep')
      .post(`/api/reservations/${resId}/folio/charges`, {
        conceptId: concept.body.id,
        quantity: 2,
      })
      .expect(201);
    expect(folio.body.totals).toMatchObject({
      chargesCents: 7000,
      grossCents: 307000,
    });
  });

  it('descuento dentro del tope sí; arriba del tope pide autorización con PIN', async () => {
    // Tope: 10 % de $3,070 = $307.
    await as('recep')
      .post(`/api/reservations/${resId}/folio/discounts`, {
        amount: 200,
        reason: 'Cortesía',
      })
      .expect(201);

    const noAuth = await as('recep')
      .post(`/api/reservations/${resId}/folio/discounts`, {
        amount: 200,
        reason: 'Más',
      })
      .expect(403);
    expect(noAuth.body.message).toBe(
      'Un descuento arriba del tope requiere autorización',
    );

    // El admin aún no tiene PIN.
    const noPin = await as('recep')
      .post(`/api/reservations/${resId}/folio/discounts`, {
        amount: 200,
        reason: 'Más',
        authorization: { authorizerId: adminId, pin: '1234' },
      })
      .expect(403);
    expect(noPin.body.message).toMatch(/aún no configura su PIN/);

    // Recepción no puede tener PIN; el admin sí.
    await as('recep')
      .patch('/api/auth/me/pin', { currentPassword: password, pin: '1234' })
      .expect(403);
    await as('admin')
      .patch('/api/auth/me/pin', { currentPassword: password, pin: '4821' })
      .expect(204);
    const authorizers = await as('recep')
      .get('/api/auth/authorizers')
      .expect(200);
    expect(authorizers.body).toEqual([
      expect.objectContaining({ id: adminId, name: 'Gerente', hasPin: true }),
    ]);

    await as('recep')
      .post(`/api/reservations/${resId}/folio/discounts`, {
        amount: 200,
        reason: 'Más',
        authorization: { authorizerId: adminId, pin: '0000' },
      })
      .expect(403);
    const ok = await as('recep')
      .post(`/api/reservations/${resId}/folio/discounts`, {
        amount: 200,
        reason: 'Queja por ruido',
        authorization: { authorizerId: adminId, pin: '4821' },
      })
      .expect(201);
    const last = ok.body.entries.at(-1);
    expect(last).toMatchObject({ kind: 'DISCOUNT', amountCents: 20000 });
    expect(last.authorizedBy.name).toBe('Gerente');
    expect(ok.body.totals.balanceCents).toBe(267000);
  });

  it('sin turno de caja abierto no se puede cobrar', async () => {
    const noShift = await as('recep')
      .post(`/api/reservations/${resId}/payments`, {
        method: 'CASH',
        amount: 100,
      })
      .expect(409);
    expect(noShift.body.message).toBe(
      'Abre tu turno de caja para poder cobrar',
    );
    await as('recep').post('/api/cash-shifts', { openingMxn: 500 }).expect(201);
    await as('admin').post('/api/cash-shifts', {}).expect(201);
  });

  it('anticipo en dólares con el tipo de cambio del día', async () => {
    const noRate = await as('recep')
      .post(`/api/reservations/${resId}/payments`, {
        method: 'CASH',
        currency: 'USD',
        amount: 50,
      })
      .expect(400);
    expect(noRate.body.message).toMatch(/tipo de cambio/);

    const today = await as('recep')
      .get('/api/exchange-rates/today')
      .expect(200);
    expect(today.body.rate).toBeNull();
    await as('recep')
      .put('/api/exchange-rates/today', { rate: 17.5 })
      .expect(200);
    await as('recep')
      .put('/api/exchange-rates/today', { rate: 18 })
      .expect(409);
    await as('admin')
      .put('/api/exchange-rates/today', { rate: 17.2345 })
      .expect(200);

    const folio = await as('recep')
      .post(`/api/reservations/${resId}/payments`, {
        method: 'CASH',
        currency: 'USD',
        amount: 50,
      })
      .expect(201);
    const payment = folio.body.payments[0];
    // 50 × 17.2345 = 861.725 → $861.73
    expect(payment).toMatchObject({
      receiptNumber: 'A-000001',
      currency: 'USD',
      amountCents: 5000,
      amountMxnCents: 86173,
      exchangeRate: 17.2345,
      isDeposit: true,
    });
    expect(folio.body.depositPaid).toBe(true);
    expect(folio.body.totals.balanceCents).toBe(267000 - 86173);
  });

  it('no permite pagar más del saldo; pagar el resto deja la cuenta en cero', async () => {
    const over = await as('recep')
      .post(`/api/reservations/${resId}/payments`, {
        method: 'CASH',
        amount: 5000,
      })
      .expect(400);
    expect(over.body.message).toMatch(/supera el saldo/);
    const folio = await as('recep')
      .post(`/api/reservations/${resId}/payments`, {
        method: 'CREDIT_CARD',
        amount: 1808.27,
        reference: '4521',
      })
      .expect(201);
    expect(folio.body.totals.balanceCents).toBe(0);
    expect(folio.body.payments[1].receiptNumber).toBe('A-000002');
  });

  it('solo el ADMIN cancela pagos; queda el registro con motivo', async () => {
    const folio = await as('recep')
      .get(`/api/reservations/${resId}/folio`)
      .expect(200);
    const paymentId = folio.body.payments[1].id;
    await as('recep')
      .post(`/api/reservations/${resId}/payments/${paymentId}/void`, {
        reason: 'x',
      })
      .expect(403);
    const voided = await as('admin')
      .post(`/api/reservations/${resId}/payments/${paymentId}/void`, {
        reason: 'Se cobró dos veces',
      })
      .expect(201);
    expect(voided.body.payments[1]).toMatchObject({
      voided: true,
      voidReason: 'Se cobró dos veces',
    });
    expect(voided.body.totals.balanceCents).toBe(180827);
  });

  it('devuelve el saldo a favor', async () => {
    // Paga todo y luego recibe un descuento: queda saldo a favor.
    await as('recep')
      .post(`/api/reservations/${resId}/payments`, {
        method: 'CASH',
        amount: 1808.27,
      })
      .expect(201);
    const withDiscount = await as('admin')
      .post(`/api/reservations/${resId}/folio/discounts`, {
        amount: 100,
        reason: 'Ajuste',
      })
      .expect(201);
    expect(withDiscount.body.totals.balanceCents).toBe(-10000);
    const refunded = await as('recep')
      .post(`/api/reservations/${resId}/refunds`, {
        method: 'CASH',
        amount: 100,
        reason: 'Devolución del ajuste',
      })
      .expect(201);
    expect(refunded.body.totals.balanceCents).toBe(0);
  });

  it('check-out con saldo: exige motivo y autorización; queda como cuenta por cobrar', async () => {
    const created = await as('recep')
      .post('/api/reservations', {
        modality: 'DAILY',
        arrivalDate: todayIn(TZ),
        arrivalTime: nowTime(),
        units: 1,
        adults: 2,
        guestId,
        roomTypeId: typeId,
        source: 'WALK_IN',
      })
      .expect(201);
    const id = created.body.id;
    await as('recep')
      .post(`/api/reservations/${id}/check-in`, { roomId: roomIds[0] })
      .expect(201);

    const desk = await as('recep')
      .get('/api/reservations/front-desk')
      .expect(200);
    expect(
      desk.body.inHouse.find((r: { id: string }) => r.id === id).balanceCents,
    ).toBe(120000);

    const noReason = await as('recep')
      .post(`/api/reservations/${id}/check-out`)
      .expect(400);
    expect(noReason.body.message).toMatch(/Hay saldo pendiente/);
    await as('recep')
      .post(`/api/reservations/${id}/check-out`, {
        balanceReason: 'Paga mañana',
      })
      .expect(403);
    const res = await as('recep')
      .post(`/api/reservations/${id}/check-out`, {
        balanceReason: 'Paga mañana',
        authorization: { authorizerId: adminId, pin: '4821' },
      })
      .expect(201);
    expect(res.body).toMatchObject({ status: 'CHECKED_OUT' });
    const folio = await as('recep')
      .get(`/api/reservations/${id}/folio`)
      .expect(200);
    expect(folio.body.reservation).toMatchObject({
      balanceDueCents: 120000,
      balanceReason: 'Paga mañana',
      balanceAuthorizedBy: { name: 'Gerente' },
    });

    // Aparece en cuentas por cobrar y en la bitácora con quién autorizó.
    const receivables = await as('recep').get('/api/receivables').expect(200);
    expect(receivables.body).toEqual([
      expect.objectContaining({ id, balanceCents: 120000 }),
    ]);
    await as('recep').get('/api/audit-logs').expect(403);
    const audit = await as('admin')
      .get(`/api/audit-logs?entity=reservation&entityId=${id}`)
      .expect(200);
    expect(audit.body.data[0]).toMatchObject({
      action: 'reservation.checkout_balance',
      actor: { name: 'Recepción' },
      authorizedBy: { name: 'Gerente' },
    });

    // Al liquidarla deja de ser cuenta por cobrar.
    await as('recep')
      .post(`/api/reservations/${id}/payments`, {
        method: 'TRANSFER',
        amount: 1200,
      })
      .expect(201);
    expect((await as('recep').get('/api/receivables')).body).toEqual([]);
  });

  it('confirma o condona cargos sugeridos (condonar cuenta para el tope)', async () => {
    const reservation = await prisma.reservation.findFirstOrThrow({
      where: { hotelId, status: 'CHECKED_OUT' },
    });
    const [small, big] = await Promise.all(
      [150, 900].map((amount) =>
        prisma.stayCharge.create({
          data: {
            hotelId,
            reservationId: reservation.id,
            kind: 'LATE_CHECK_OUT',
            description: 'Salida tardía',
            hours: 1,
            amount,
            createdById: adminId,
          },
        }),
      ),
    );
    const url = (id: string) =>
      `/api/reservations/${reservation.id}/stay-charges/${id}/resolve`;

    const noReason = await as('recep')
      .post(url(small.id), { action: 'WAIVE' })
      .expect(400);
    expect(noReason.body.message).toBe(
      'Indica el motivo para condonar el cargo',
    );
    // $150 dentro del tope (10 % de $1,200 = $120)? No: necesita autorización.
    await as('recep')
      .post(url(small.id), { action: 'WAIVE', reason: 'Cortesía' })
      .expect(403);
    await as('recep')
      .post(url(small.id), {
        action: 'WAIVE',
        reason: 'Cortesía',
        authorization: { authorizerId: adminId, pin: '4821' },
      })
      .expect(201);

    const confirmed = await as('recep')
      .post(url(big.id), { action: 'CONFIRM' })
      .expect(201);
    expect(confirmed.body.totals.chargesCents).toBe(90000);
    expect(
      confirmed.body.stayCharges
        .map((c: { status: string }) => c.status)
        .sort(),
    ).toEqual(['CONFIRMED', 'WAIVED']);
  });
});
