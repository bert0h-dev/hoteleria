/**
 * Copia exacta de backend/src/modules/pricing/pricing.ts para mostrar
 * cálculos en vivo en los formularios. La API sigue siendo la fuente de
 * verdad: si cambias una fórmula, cámbiala en ambos lados.
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

export function calculateHourlyStay(
  hours: number,
  nightlyRate: number,
  settings: PricingSettings,
) {
  const billedHours = Math.max(Math.ceil(hours), settings.minHours);
  const { hourly } = calculateRates(nightlyRate, settings);
  return { billedHours, rate: hourly, total: billedHours * hourly };
}

export function calculateNightlyStay(
  nights: number,
  nightlyRate: number,
  settings: PricingSettings,
) {
  const weeks = Math.floor(nights / 7);
  const extraNights = nights % 7;
  const { weekly, nightly } = calculateRates(nightlyRate, settings);
  return { weeks, extraNights, total: weeks * weekly + extraNights * nightly };
}
