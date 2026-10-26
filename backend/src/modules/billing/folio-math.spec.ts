import {
  exceedsDiscountCap,
  folioTotals,
  percentOfCents,
  toCents,
  usdToMxnCents,
} from './folio-math.js';

describe('folio', () => {
  it('convierte pesos y dólares a centavos', () => {
    expect(toCents(1250)).toBe(125000);
    expect(toCents(35.5)).toBe(3550);
    expect(toCents(0.1 + 0.2)).toBe(30); // sin errores de punto flotante
    // 50 USD × 17.2345 = 861.725 → 861.73
    expect(usdToMxnCents(5000, 17.2345)).toBe(86173);
  });

  it('calcula bruto, neto, pagado y saldo', () => {
    const totals = folioTotals({
      lodgingCents: 300000,
      charges: [{ amountCents: 7000 }, { amountCents: 45000 }],
      discounts: [{ amountCents: 10000 }],
      payments: [
        { kind: 'PAYMENT', amountMxnCents: 100000 },
        { kind: 'PAYMENT', amountMxnCents: 86173 },
      ],
    });
    expect(totals).toEqual({
      lodgingCents: 300000,
      chargesCents: 52000,
      grossCents: 352000,
      discountsCents: 10000,
      netCents: 342000,
      paidCents: 186173,
      refundedCents: 0,
      balanceCents: 155827,
    });
  });

  it('saldo negativo cuando se pagó de más; la devolución lo regresa a cero', () => {
    const base = {
      lodgingCents: 100000,
      charges: [],
      discounts: [{ amountCents: 20000 }],
    };
    expect(
      folioTotals({
        ...base,
        payments: [{ kind: 'PAYMENT', amountMxnCents: 100000 }],
      }).balanceCents,
    ).toBe(-20000);
    expect(
      folioTotals({
        ...base,
        payments: [
          { kind: 'PAYMENT', amountMxnCents: 100000 },
          { kind: 'REFUND', amountMxnCents: 20000 },
        ],
      }).balanceCents,
    ).toBe(0);
  });

  it('tope de descuento acumulado', () => {
    expect(percentOfCents(352000, 10)).toBe(35200);
    // 10 % de $3,520 = $352: $300 cabe; $300 + $100 no.
    expect(
      exceedsDiscountCap({
        grossCents: 352000,
        previousCents: 0,
        newCents: 30000,
        capPercent: 10,
      }),
    ).toBe(false);
    expect(
      exceedsDiscountCap({
        grossCents: 352000,
        previousCents: 30000,
        newCents: 10000,
        capPercent: 10,
      }),
    ).toBe(true);
    // Exactamente el tope sí se permite.
    expect(
      exceedsDiscountCap({
        grossCents: 352000,
        previousCents: 0,
        newCents: 35200,
        capPercent: 10,
      }),
    ).toBe(false);
  });
});
