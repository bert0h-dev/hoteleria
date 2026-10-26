import { shiftTotals, type ShiftPayment } from './shift-math.js';

const pay = (p: Partial<ShiftPayment>): ShiftPayment => ({
  kind: 'PAYMENT',
  method: 'CASH',
  currency: 'MXN',
  amountCents: 0,
  amountMxnCents: 0,
  voidedAt: null,
  ...p,
});

describe('shiftTotals', () => {
  const opening = { openingMxnCents: 100000, openingUsdCents: 5000 };

  it('sin movimientos, el esperado es el fondo', () => {
    const t = shiftTotals(opening, []);
    expect(t).toMatchObject({
      byMethod: [],
      netMxnCents: 0,
      expectedMxnCents: 100000,
      expectedUsdCents: 5000,
    });
  });

  it('el efectivo suma por moneda; tarjeta no cuenta en el esperado', () => {
    const t = shiftTotals(opening, [
      pay({ amountCents: 30000, amountMxnCents: 30000 }),
      pay({ method: 'CREDIT_CARD', amountCents: 20000, amountMxnCents: 20000 }),
      pay({ currency: 'USD', amountCents: 1000, amountMxnCents: 17500 }),
      pay({ kind: 'REFUND', amountCents: 5000, amountMxnCents: 5000 }),
    ]);
    expect(t.expectedMxnCents).toBe(100000 + 30000 - 5000);
    expect(t.expectedUsdCents).toBe(5000 + 1000);
    expect(t.netMxnCents).toBe(30000 + 20000 + 17500 - 5000);
    expect(t.byMethod).toContainEqual({
      method: 'CASH',
      currency: 'MXN',
      paymentsCents: 30000,
      refundsCents: 5000,
      netMxnCents: 25000,
      count: 2,
    });
  });

  it('los pagos cancelados no cuentan', () => {
    const t = shiftTotals(opening, [
      pay({ amountCents: 30000, amountMxnCents: 30000, voidedAt: new Date() }),
    ]);
    expect(t.expectedMxnCents).toBe(100000);
    expect(t.voidedCount).toBe(1);
  });
});
