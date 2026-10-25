/**
 * Fórmulas de tarifas. Los precios son pesos enteros con impuestos
 * incluidos: cada tarifa se redondea al peso más cercano. Solo el desglose
 * de impuestos lleva centavos.
 *
 * El precio base es por noche; las demás modalidades se derivan de él con
 * los porcentajes que configura cada hotel (HotelSettings).
 *
 * Hay una copia exacta en frontend/src/features/hotel/pricing.ts.
 */

export interface PricingSettings {
  hourlyRatePercent: number;
  minHours: number;
  dayRatePercent: number;
  dayDurationHours: number;
  weekRatePercent: number;
  capHourlyAtDayRate: boolean;
}

export interface TaxSettings {
  vatPercent: number;
  lodgingTaxPercent: number;
}

export interface Rates {
  hourly: number;
  nightly: number;
  daily: number;
  weekly: number;
}

const percentOf = (amount: number, percent: number) =>
  Math.round((amount * percent) / 100);

/** Tarifas por hora, noche, día y semana a partir del precio por noche. */
export function calculateRates(
  nightlyRate: number,
  settings: PricingSettings,
): Rates {
  return {
    hourly: percentOf(nightlyRate, settings.hourlyRatePercent),
    nightly: nightlyRate,
    daily: percentOf(nightlyRate, settings.dayRatePercent),
    weekly: percentOf(nightlyRate, settings.weekRatePercent),
  };
}

/**
 * Estancia por horas: se cobra como mínimo `minHours`. Si el hotel tiene
 * el tope activo y las horas cuestan más que el día completo, se cobra el día.
 */
export function calculateHourlyStay(
  hours: number,
  nightlyRate: number,
  settings: PricingSettings,
) {
  const billedHours = Math.max(Math.ceil(hours), settings.minHours);
  const { hourly, daily } = calculateRates(nightlyRate, settings);
  const byHours = billedHours * hourly;
  const cappedAtDay = settings.capHourlyAtDayRate && byHours > daily;
  return {
    billedHours,
    rate: hourly,
    total: cappedAtDay ? daily : byHours,
    cappedAtDay,
  };
}

/**
 * A partir de cuántas horas conviene cobrar el día completo (null si nunca,
 * p. ej. con el tope desactivado o con tarifa por hora en 0).
 */
export function hoursUntilDayRate(
  nightlyRate: number,
  settings: PricingSettings,
): number | null {
  const { hourly, daily } = calculateRates(nightlyRate, settings);
  if (!settings.capHourlyAtDayRate || hourly <= 0) return null;
  return Math.max(Math.ceil(daily / hourly), settings.minHours);
}

/** Estancia por noches: las semanas completas se cobran como bloque. */
export function calculateNightlyStay(
  nights: number,
  nightlyRate: number,
  settings: PricingSettings,
) {
  const weeks = Math.floor(nights / 7);
  const extraNights = nights % 7;
  const { weekly, nightly } = calculateRates(nightlyRate, settings);
  return {
    weeks,
    extraNights,
    total: weeks * weekly + extraNights * nightly,
  };
}

/** Salida de un día completo: entrada + `dayDurationHours`. */
export function calculateDayCheckOut(
  checkIn: Date,
  settings: Pick<PricingSettings, 'dayDurationHours'>,
): Date {
  return new Date(
    checkIn.getTime() + settings.dayDurationHours * 60 * 60 * 1000,
  );
}

export interface ExtraGuestRates {
  includedAdults: number;
  extraAdultRate: number;
  extraChildRate: number;
}

/**
 * Cargo por personas extra. Los adultos por encima de los incluidos y cada
 * niño pagan su cargo por noche o por día; en estancias por horas no hay
 * cargo. Las semanas cuentan como 7 noches.
 */
export function calculateExtraGuests(
  guests: { adults: number; children: number },
  type: ExtraGuestRates,
  stay: { modality: 'hourly' | 'nightly' | 'daily'; units: number },
) {
  const extraAdults = Math.max(0, guests.adults - type.includedAdults);
  const perUnit =
    extraAdults * type.extraAdultRate + guests.children * type.extraChildRate;
  const units = stay.modality === 'hourly' ? 0 : stay.units;
  return { extraAdults, perUnit, total: perUnit * units };
}

export interface TaxBreakdown {
  subtotal: number;
  vat: number;
  lodgingTax: number;
  total: number;
}

/**
 * Desglosa un total con impuestos incluidos:
 *   subtotal = total / (1 + IVA + ISH)
 * Todo se calcula en centavos y el subtotal absorbe el redondeo, así la
 * suma siempre cuadra exactamente con el total.
 */
export function calculateTaxBreakdown(
  total: number,
  taxes: TaxSettings,
): TaxBreakdown {
  const totalCents = Math.round(total * 100);
  const vatRate = taxes.vatPercent / 100;
  const lodgingRate = taxes.lodgingTaxPercent / 100;
  const base = totalCents / (1 + vatRate + lodgingRate);
  const vatCents = Math.round(base * vatRate);
  const lodgingCents = Math.round(base * lodgingRate);
  const subtotalCents = totalCents - vatCents - lodgingCents;
  return {
    subtotal: subtotalCents / 100,
    vat: vatCents / 100,
    lodgingTax: lodgingCents / 100,
    total: totalCents / 100,
  };
}
