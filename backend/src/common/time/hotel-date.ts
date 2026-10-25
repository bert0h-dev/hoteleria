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
