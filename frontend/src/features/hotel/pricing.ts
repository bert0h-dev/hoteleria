/**
 * Fórmulas de tarifas. Los precios son pesos enteros con impuestos
 * incluidos: cada tarifa se redondea al peso más cercano. Solo el desglose
 * de impuestos lleva centavos.
 *
 * El precio base es por noche; las demás modalidades se derivan de él con
 * los porcentajes que configura cada hotel (HotelSettings).
 *
 * Copia exacta de backend/src/modules/pricing/pricing.ts para mostrar
 * cálculos en vivo. La API sigue siendo la fuente de verdad: si cambias una
 * fórmula, cámbiala en ambos lados.
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

// ---------------------------------------------------------------------------
// Temporadas y días de la semana
// ---------------------------------------------------------------------------

export interface SeasonRule {
  name: string;
  /** YYYY-MM-DD, inclusive. */
  startDate: string;
  endDate: string;
  adjustmentPercent: number;
  priority: number;
  color?: string;
}

export interface WeekdayRule {
  /** 0 = domingo … 6 = sábado. */
  days: number[];
  percent: number;
}

export interface NightPrice {
  /** YYYY-MM-DD de la noche (la fecha en que se entra esa noche). */
  date: string;
  rate: number;
  adjustmentPercent: number;
  source: 'season' | 'weekday' | 'base';
  seasonName?: string;
}

const dayLength = (s: SeasonRule) =>
  Date.parse(`${s.endDate}T00:00:00Z`) - Date.parse(`${s.startDate}T00:00:00Z`);

/**
 * Ajuste de una noche: si cae en una temporada aplica la temporada (la de
 * mayor prioridad; si empatan, la más corta). Si no, el ajuste por día de
 * la semana. Nunca ambos.
 */
export function nightAdjustment(
  date: string,
  seasons: SeasonRule[],
  weekday?: WeekdayRule,
): Pick<NightPrice, 'adjustmentPercent' | 'source' | 'seasonName'> {
  const season = seasons
    .filter((s) => s.startDate <= date && date <= s.endDate)
    .sort((a, b) => b.priority - a.priority || dayLength(a) - dayLength(b))[0];
  if (season) {
    return {
      adjustmentPercent: season.adjustmentPercent,
      source: 'season',
      seasonName: season.name,
    };
  }
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
  if (weekday && weekday.percent !== 0 && weekday.days.includes(dow)) {
    return { adjustmentPercent: weekday.percent, source: 'weekday' };
  }
  return { adjustmentPercent: 0, source: 'base' };
}

/** Precio por noche ajustado, redondeado al peso. */
export function adjustRate(rate: number, percent: number): number {
  return Math.round((rate * (100 + percent)) / 100);
}

/** Precio de cada noche de una estancia. */
export function priceNights(
  nightlyRate: number,
  dates: string[],
  seasons: SeasonRule[],
  weekday?: WeekdayRule,
): NightPrice[] {
  return dates.map((date) => {
    const adj = nightAdjustment(date, seasons, weekday);
    return {
      date,
      rate: adjustRate(nightlyRate, adj.adjustmentPercent),
      ...adj,
    };
  });
}

/**
 * Estancia por noches con precios variables: cada bloque de 7 noches
 * cuesta la suma de sus noches × (porcentaje semanal / 700); con el 600 %
 * por defecto la semana sigue "regalando" una noche. Las noches sueltas
 * se cobran a su precio.
 */
export function calculateVariableNightlyStay(
  nights: Pick<NightPrice, 'rate'>[],
  settings: Pick<PricingSettings, 'weekRatePercent'>,
) {
  const weeks = Math.floor(nights.length / 7);
  let total = 0;
  for (let w = 0; w < weeks; w++) {
    const block = nights.slice(w * 7, w * 7 + 7);
    const sum = block.reduce((acc, n) => acc + n.rate, 0);
    total += Math.round((sum * settings.weekRatePercent) / 700);
  }
  for (const n of nights.slice(weeks * 7)) total += n.rate;
  return { weeks, extraNights: nights.length % 7, total };
}
