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
  return new Date(iso).toLocaleDateString('es-MX', { dateStyle: 'medium' });
}

/** "25 oct 2026, 14:30". */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
