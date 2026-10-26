/**
 * Cálculo de una estancia: entrada, salida y precio según la modalidad.
 * Funciones puras (sin base de datos) para poder probarlas a fondo.
 */
import {
  addDaysTo,
  daysBetween,
  zonedToUtc,
} from '../../common/time/hotel-date.js';
import {
  calculateExtraGuests,
  calculateHourlyStay,
  calculateRates,
  calculateTaxBreakdown,
  calculateVariableNightlyStay,
  priceNights,
  type ExtraGuestRates,
  type NightPrice,
  type PricingSettings,
  type SeasonRule,
  type TaxSettings,
  type WeekdayRule,
} from '../pricing/pricing.js';

export type Modality = 'NIGHTLY' | 'DAILY' | 'HOURLY';

/** Lo que captura recepción. */
export interface StayRequest {
  modality: Modality;
  /** NIGHTLY: fecha de llegada; DAILY/HOURLY: fecha de entrada. */
  arrivalDate: string;
  /** Solo NIGHTLY: fecha de salida. */
  departureDate?: string;
  /** DAILY/HOURLY: hora de entrada (HH:mm). */
  arrivalTime?: string;
  /** DAILY: número de días; HOURLY: número de horas. */
  units?: number;
}

export interface StaySettings extends PricingSettings, TaxSettings {
  checkInTime: string;
  checkOutTime: string;
}

export interface Stay {
  checkIn: Date;
  checkOut: Date;
  /** Noches, días u horas. */
  units: number;
}

export class StayError extends Error {}

export function computeStay(
  req: StayRequest,
  settings: StaySettings,
  timeZone: string,
): Stay {
  if (req.modality === 'NIGHTLY') {
    if (!req.departureDate) throw new StayError('Indica la fecha de salida');
    const nights = daysBetween(req.arrivalDate, req.departureDate);
    if (nights < 1) {
      throw new StayError(
        'La salida debe ser al menos un día después de la llegada',
      );
    }
    return {
      checkIn: zonedToUtc(req.arrivalDate, settings.checkInTime, timeZone),
      checkOut: zonedToUtc(req.departureDate, settings.checkOutTime, timeZone),
      units: nights,
    };
  }

  if (!req.arrivalTime) throw new StayError('Indica la hora de entrada');
  const units = req.units ?? 1;
  if (!Number.isInteger(units) || units < 1) {
    throw new StayError(
      req.modality === 'DAILY'
        ? 'Los días deben ser un número entero mayor a 0'
        : 'Las horas deben ser un número entero mayor a 0',
    );
  }
  const checkIn = zonedToUtc(req.arrivalDate, req.arrivalTime, timeZone);
  const hours =
    req.modality === 'DAILY' ? units * settings.dayDurationHours : units;
  return {
    checkIn,
    checkOut: new Date(checkIn.getTime() + hours * 3_600_000),
    units,
  };
}

export interface QuoteRoomType extends ExtraGuestRates {
  nightlyRate: number;
}

export interface Quote {
  nightlyRate: number;
  baseAmount: number;
  extrasAmount: number;
  totalAmount: number;
  detail: {
    modality: Modality;
    units: number;
    /** NIGHTLY: semanas completas y noches sueltas. */
    weeks?: number;
    extraNights?: number;
    /** HOURLY: horas cobradas (mínimo) y si se aplicó el tope del día. */
    billedHours?: number;
    cappedAtDay?: boolean;
    /** NIGHTLY: precio de cada noche (con su temporada o ajuste). */
    nights?: NightPrice[];
    /** DAILY/HOURLY: precio por noche ajustado del día de entrada. */
    rateDay?: NightPrice;
    extraAdults: number;
    extrasPerUnit: number;
    taxes: ReturnType<typeof calculateTaxBreakdown>;
  };
}

/** Temporadas y ajuste por día de la semana vigentes para cotizar. */
export interface PriceCalendar {
  /** Fecha de llegada (YYYY-MM-DD) en la zona del hotel. */
  arrivalDate: string;
  seasons: SeasonRule[];
  weekday?: WeekdayRule;
}

/**
 * Precio de una estancia para un tipo de habitación.
 * - Por noche: cada noche con su temporada o ajuste por día de la semana.
 * - Por día u horas: se usa el precio ajustado del día de entrada.
 * Las personas extra no cambian con la temporada.
 */
export function computeQuote(
  type: QuoteRoomType,
  stay: Pick<Stay, 'units'>,
  modality: Modality,
  guests: { adults: number; children: number },
  settings: StaySettings,
  calendar?: PriceCalendar,
): Quote {
  let baseAmount: number;
  const detail: Partial<Quote['detail']> = { modality, units: stay.units };
  const seasons = calendar?.seasons ?? [];
  const arrival = calendar?.arrivalDate ?? '2000-01-01';

  if (modality === 'NIGHTLY') {
    const dates = Array.from({ length: stay.units }, (_, i) =>
      addDaysTo(arrival, i),
    );
    const nights = priceNights(
      type.nightlyRate,
      dates,
      seasons,
      calendar?.weekday,
    );
    const nightly = calculateVariableNightlyStay(nights, settings);
    baseAmount = nightly.total;
    detail.weeks = nightly.weeks;
    detail.extraNights = nightly.extraNights;
    detail.nights = nights;
  } else {
    const [rateDay] = priceNights(
      type.nightlyRate,
      [arrival],
      seasons,
      calendar?.weekday,
    );
    detail.rateDay = rateDay;
    if (modality === 'DAILY') {
      baseAmount = calculateRates(rateDay.rate, settings).daily * stay.units;
    } else {
      const hourly = calculateHourlyStay(stay.units, rateDay.rate, settings);
      baseAmount = hourly.total;
      detail.billedHours = hourly.billedHours;
      detail.cappedAtDay = hourly.cappedAtDay;
    }
  }

  const extras = calculateExtraGuests(guests, type, {
    modality:
      modality === 'NIGHTLY'
        ? 'nightly'
        : modality === 'DAILY'
          ? 'daily'
          : 'hourly',
    units: stay.units,
  });
  const totalAmount = baseAmount + extras.total;

  return {
    nightlyRate: type.nightlyRate,
    baseAmount,
    extrasAmount: extras.total,
    totalAmount,
    detail: {
      ...detail,
      extraAdults: extras.extraAdults,
      extrasPerUnit: extras.perUnit,
      taxes: calculateTaxBreakdown(totalAmount, settings),
    } as Quote['detail'],
  };
}

/**
 * Máximo de estancias simultáneas dentro de [from, to). Dos estancias que
 * no se cruzan pueden usar la misma habitación, así que lo que limita la
 * disponibilidad es el pico, no el total.
 */
export function peakOccupancy(
  stays: { checkIn: Date; checkOut: Date }[],
  from: Date,
  to: Date,
): number {
  const events: [number, number][] = [];
  for (const s of stays) {
    const start = Math.max(s.checkIn.getTime(), from.getTime());
    const end = Math.min(s.checkOut.getTime(), to.getTime());
    if (start < end) events.push([start, 1], [end, -1]);
  }
  // A la misma hora, primero las salidas: quien sale libera la habitación
  // para quien entra.
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let current = 0;
  let peak = 0;
  for (const [, delta] of events) {
    current += delta;
    peak = Math.max(peak, current);
  }
  return peak;
}
