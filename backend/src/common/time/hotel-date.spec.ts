import {
  fromDbDate,
  isBlockOverdue,
  isValidTimeZone,
  todayIn,
  toDbDate,
} from './hotel-date.js';

describe('fechas en la zona horaria del hotel', () => {
  // 25 oct 2026, 23:30 en CDMX (UTC-6) = 26 oct 05:30 UTC.
  // Cancún (UTC-5) ya es 26 oct 00:30.
  const now = new Date('2026-10-26T05:30:00Z');

  it('calcula "hoy" según la zona horaria', () => {
    expect(todayIn('America/Mexico_City', now)).toBe('2026-10-25');
    expect(todayIn('America/Cancun', now)).toBe('2026-10-26');
    expect(todayIn('America/Tijuana', now)).toBe('2026-10-25');
  });

  it('valida zonas horarias IANA', () => {
    expect(isValidTimeZone('America/Mexico_City')).toBe(true);
    expect(isValidTimeZone('America/Hermosillo')).toBe(true);
    expect(isValidTimeZone('Mexico/Nada')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
  });

  it('convierte entre texto y columna DATE', () => {
    const d = toDbDate('2026-10-28');
    expect(d.toISOString()).toBe('2026-10-28T00:00:00.000Z');
    expect(fromDbDate(d)).toBe('2026-10-28');
    expect(() => toDbDate('28/10/2026')).toThrow();
  });

  it('el bloqueo vence cuando su último día ya pasó', () => {
    const until = toDbDate('2026-10-25');
    // En CDMX aún es 25: no ha vencido (el 25 es el último día bloqueado).
    expect(isBlockOverdue(until, 'America/Mexico_City', now)).toBe(false);
    // En Cancún ya es 26: venció.
    expect(isBlockOverdue(until, 'America/Cancun', now)).toBe(true);
    // Sin fecha (indefinido) nunca vence.
    expect(isBlockOverdue(null, 'America/Cancun', now)).toBe(false);
  });
});
