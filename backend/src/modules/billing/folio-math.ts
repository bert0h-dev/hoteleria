/**
 * Cálculos del folio. Todo en centavos para que el saldo cuadre exacto
 * (las tarifas son pesos enteros, pero hay descuentos en %, dólares…).
 */

/** Pesos (hasta 2 decimales) → centavos. */
export function toCents(pesos: number): number {
  return Math.round(pesos * 100);
}

/** Centavos de dólar → centavos de peso con el tipo de cambio. */
export function usdToMxnCents(usdCents: number, rate: number): number {
  return Math.round(usdCents * rate);
}

export interface FolioLines {
  /** Hospedaje (total de la reserva) en centavos. */
  lodgingCents: number;
  charges: { amountCents: number }[];
  discounts: { amountCents: number }[];
  payments: { kind: 'PAYMENT' | 'REFUND'; amountMxnCents: number }[];
}

export interface FolioTotals {
  lodgingCents: number;
  chargesCents: number;
  /** Hospedaje + cargos. */
  grossCents: number;
  discountsCents: number;
  /** Lo que debe pagar: bruto − descuentos. */
  netCents: number;
  paidCents: number;
  refundedCents: number;
  /** Positivo: debe; negativo: se le debe devolver. */
  balanceCents: number;
}

export function folioTotals(lines: FolioLines): FolioTotals {
  const sum = (xs: { amountCents: number }[]) =>
    xs.reduce((acc, x) => acc + x.amountCents, 0);
  const chargesCents = sum(lines.charges);
  const grossCents = lines.lodgingCents + chargesCents;
  const discountsCents = sum(lines.discounts);
  const netCents = grossCents - discountsCents;
  const paidCents = lines.payments
    .filter((p) => p.kind === 'PAYMENT')
    .reduce((acc, p) => acc + p.amountMxnCents, 0);
  const refundedCents = lines.payments
    .filter((p) => p.kind === 'REFUND')
    .reduce((acc, p) => acc + p.amountMxnCents, 0);
  return {
    lodgingCents: lines.lodgingCents,
    chargesCents,
    grossCents,
    discountsCents,
    netCents,
    paidCents,
    refundedCents,
    balanceCents: netCents - paidCents + refundedCents,
  };
}

/** Descuento en % de la cuenta (hospedaje + cargos), en centavos. */
export function percentOfCents(cents: number, percent: number): number {
  return Math.round((cents * percent) / 100);
}

/**
 * ¿El descuento (sumado a los anteriores y a lo ya condonado) rebasa el
 * tope permitido sin autorización?
 */
export function exceedsDiscountCap(input: {
  grossCents: number;
  /** Descuentos y condonaciones previos. */
  previousCents: number;
  newCents: number;
  capPercent: number;
}): boolean {
  const cap = percentOfCents(input.grossCents, input.capPercent);
  return input.previousCents + input.newCents > cap;
}
