/** Estructura común de todos los reportes (pantalla, impresión y Excel). */

export type ColumnType =
  | 'text'
  | 'int'
  /** Centavos de peso. */
  | 'money'
  /** Centavos de dólar. */
  | 'usd'
  | 'percent'
  | 'date'
  | 'datetime';

export interface ReportColumn {
  key: string;
  label: string;
  type: ColumnType;
}

export type ReportRow = Record<string, string | number | null>;

export interface ReportSection {
  title: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  totals?: ReportRow;
}

export interface ReportSummaryItem {
  label: string;
  value: number;
  type: ColumnType;
}

export interface Report {
  kind: ReportKind;
  title: string;
  from: string;
  to: string;
  notes?: string;
  summary: ReportSummaryItem[];
  sections: ReportSection[];
}

export const REPORT_KINDS = [
  'occupancy',
  'revenue',
  'payments',
  'discounts',
  'reservations',
  'rentals',
  'housekeeping',
  'maintenance',
] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

/** Suma columnas numéricas de varias filas. */
export function sumRows(rows: ReportRow[], keys: string[]): ReportRow {
  const totals: ReportRow = {};
  for (const key of keys) {
    totals[key] = rows.reduce((n, r) => n + (Number(r[key]) || 0), 0);
  }
  return totals;
}

export const pct = (part: number, whole: number) =>
  whole ? Math.round((part / whole) * 1000) / 10 : 0;
