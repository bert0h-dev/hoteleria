/**
 * Fórmulas de tarifas. Todas las cantidades son pesos enteros: cada
 * resultado se redondea al peso más cercano.
 *
 * El precio base es por noche; las demás modalidades se derivan de él con
 * los porcentajes que configura cada hotel (HotelSettings).
 */

export interface PricingSettings {
  hourlyRatePercent: number;
  minHours: number;
  dayRatePercent: number;
  dayDurationHours: number;
  weekRatePercent: number;
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

/** Estancia por horas: se cobra como mínimo `minHours`. */
export function calculateHourlyStay(
  hours: number,
  nightlyRate: number,
  settings: PricingSettings,
) {
  const billedHours = Math.max(Math.ceil(hours), settings.minHours);
  const { hourly } = calculateRates(nightlyRate, settings);
  return { billedHours, rate: hourly, total: billedHours * hourly };
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
