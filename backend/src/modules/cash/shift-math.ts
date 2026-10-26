import type {
  Currency,
  PaymentKind,
  PaymentMethod,
} from '../../generated/prisma/enums.js';

export interface ShiftPayment {
  kind: PaymentKind;
  method: PaymentMethod;
  currency: Currency;
  amountCents: number;
  amountMxnCents: number;
  voidedAt: Date | null;
}

export interface MethodTotal {
  method: PaymentMethod;
  currency: Currency;
  /** En la moneda del pago (centavos). */
  paymentsCents: number;
  refundsCents: number;
  /** Neto en pesos (centavos). */
  netMxnCents: number;
  count: number;
}

export interface ShiftTotals {
  byMethod: MethodTotal[];
  /** Neto cobrado en pesos, todos los métodos (centavos). */
  netMxnCents: number;
  /** Fondo + efectivo cobrado − efectivo devuelto, por moneda. */
  expectedMxnCents: number;
  expectedUsdCents: number;
  /** Pagos cancelados (no cuentan). */
  voidedCount: number;
}

/** Totales del turno: por método y moneda, y efectivo esperado. */
export function shiftTotals(
  opening: { openingMxnCents: number; openingUsdCents: number },
  payments: ShiftPayment[],
): ShiftTotals {
  const map = new Map<string, MethodTotal>();
  let voidedCount = 0;
  for (const p of payments) {
    if (p.voidedAt) {
      voidedCount++;
      continue;
    }
    const key = `${p.method}:${p.currency}`;
    const row = map.get(key) ?? {
      method: p.method,
      currency: p.currency,
      paymentsCents: 0,
      refundsCents: 0,
      netMxnCents: 0,
      count: 0,
    };
    const sign = p.kind === 'REFUND' ? -1 : 1;
    if (sign > 0) row.paymentsCents += p.amountCents;
    else row.refundsCents += p.amountCents;
    row.netMxnCents += sign * p.amountMxnCents;
    row.count++;
    map.set(key, row);
  }
  const byMethod = [...map.values()];
  const cash = (currency: Currency) => {
    const row = byMethod.find(
      (r) => r.method === 'CASH' && r.currency === currency,
    );
    return row ? row.paymentsCents - row.refundsCents : 0;
  };
  return {
    byMethod,
    netMxnCents: byMethod.reduce((sum, r) => sum + r.netMxnCents, 0),
    expectedMxnCents: opening.openingMxnCents + cash('MXN'),
    expectedUsdCents: opening.openingUsdCents + cash('USD'),
    voidedCount,
  };
}
