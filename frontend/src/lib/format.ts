// Zona horaria del hotel: todas las fechas y horas se muestran en ella, no
// en la de la computadora. La fija MainLayout al cargar los datos del hotel.
let hotelTimeZone = 'America/Mexico_City';

export function setHotelTimeZone(timeZone: string) {
  hotelTimeZone = timeZone;
}

export function getHotelTimeZone() {
  return hotelTimeZone;
}

const currency = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
});

/** Pesos enteros: 1250 → "$1,250". */
export function formatMoney(amount: number): string {
  return currency.format(amount);
}

const relative = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

/** "hace 5 minutos", "ayer", o la fecha si ya pasó un mes. */
export function formatRelative(iso: string | null, empty = 'Nunca'): string {
  if (!iso) return empty;
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relative.format(hours, 'hour');
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return relative.format(days, 'day');
  return new Date(iso).toLocaleDateString('es-MX', {
    dateStyle: 'medium',
    timeZone: hotelTimeZone,
  });
}

/** "25 oct 2026, 14:30". */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: hotelTimeZone,
  });
}

const currencyCents = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Con centavos, para desgloses de impuestos: 840.34 → "$840.34". */
export function formatMoneyCents(amount: number): string {
  return currencyCents.format(amount);
}

// --- Fechas de calendario (YYYY-MM-DD, sin hora) ---

/** Fecha actual (YYYY-MM-DD) en la zona del hotel. */
export function todayInHotel(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: hotelTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Suma días a una fecha YYYY-MM-DD. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "2026-10-28" → "28 oct" (o "28 oct 2027" si es de otro año). */
export function formatDay(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  const sameYear = date.slice(0, 4) === todayInHotel().slice(0, 4);
  return d.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone: 'UTC',
  });
}

/** Hora actual (HH:mm) en una zona horaria. */
export function timeIn(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(now);
}

/** Fecha de un instante (ISO) en la zona del hotel: "25 oct 2026". */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', {
    dateStyle: 'medium',
    timeZone: hotelTimeZone,
  });
}

/** "28 oct, 15:00" en la zona del hotel. */
export function formatDayTime(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: hotelTimeZone,
  });
}

/** Partes de una fecha YYYY-MM-DD para encabezados: { weekday: 'lun', day: 28, month: 'oct' }. */
export function dayParts(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  const fmt = (o: Intl.DateTimeFormatOptions) =>
    d.toLocaleDateString('es-MX', { ...o, timeZone: 'UTC' }).replace('.', '');
  return {
    weekday: fmt({ weekday: 'short' }),
    day: d.getUTCDate(),
    month: fmt({ month: 'short' }),
    isWeekend: d.getUTCDay() === 0 || d.getUTCDay() === 6,
  };
}
