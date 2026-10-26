/**
 * Utilidades de fechas "de calendario" (sin hora) en la zona horaria del
 * hotel. Las fechas se manejan como texto YYYY-MM-DD y en la base como
 * DATE, que Prisma representa con un Date a medianoche UTC.
 */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Fecha actual (YYYY-MM-DD) en la zona horaria indicada. */
export function todayIn(timeZone: string, now = new Date()): string {
  // en-CA da el formato YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** "2026-10-28" → Date para una columna DATE. */
export function toDbDate(date: string): Date {
  if (!DATE_ONLY.test(date)) throw new Error(`Fecha inválida: ${date}`);
  return new Date(`${date}T00:00:00.000Z`);
}

/** Date de una columna DATE → "2026-10-28". */
export function fromDbDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** El bloqueo venció si su último día ya pasó en la zona del hotel. */
export function isBlockOverdue(
  blockedUntil: Date | null,
  timeZone: string,
  now = new Date(),
): boolean {
  return !!blockedUntil && fromDbDate(blockedUntil) < todayIn(timeZone, now);
}

/** Diferencia (ms) entre la hora local de `timeZone` y UTC en un instante. */
function offsetMs(timeZone: string, instant: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(
    +parts.year,
    +parts.month - 1,
    +parts.day,
    +parts.hour,
    +parts.minute,
    +parts.second,
  );
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * Fecha y hora locales del hotel → instante UTC.
 * zonedToUtc('2026-10-28', '15:00', 'America/Cancun') → 2026-10-28T20:00Z
 */
export function zonedToUtc(date: string, time: string, timeZone: string): Date {
  if (!DATE_ONLY.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    throw new Error(`Fecha u hora inválida: ${date} ${time}`);
  }
  const guess = new Date(`${date}T${time}:00.000Z`);
  // Dos pasadas para cubrir cambios de horario de verano.
  let result = new Date(guess.getTime() - offsetMs(timeZone, guess));
  result = new Date(guess.getTime() - offsetMs(timeZone, result));
  return result;
}

/** Días de calendario entre dos fechas YYYY-MM-DD. */
export function daysBetween(from: string, to: string): number {
  return Math.round(
    (toDbDate(to).getTime() - toDbDate(from).getTime()) / 86_400_000,
  );
}

/** Suma días a una fecha YYYY-MM-DD. */
export function addDaysTo(date: string, days: number): string {
  const d = toDbDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromDbDate(d);
}
