import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  BedDouble,
  Banknote,
  CalendarRange,
  Percent,
  Sparkles,
  TrendingUp,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Role } from '@/features/auth/types';

export type ColumnType =
  'text' | 'int' | 'money' | 'usd' | 'percent' | 'date' | 'datetime';

export interface ReportColumn {
  key: string;
  label: string;
  type: ColumnType;
}

export type ReportRow = Record<string, string | number | null>;

export interface Report {
  kind: ReportKind;
  title: string;
  from: string;
  to: string;
  notes?: string;
  summary: { label: string; value: number; type: ColumnType }[];
  sections: {
    title: string;
    columns: ReportColumn[];
    rows: ReportRow[];
    totals?: ReportRow;
  }[];
}

export type ReportKind =
  | 'occupancy'
  | 'revenue'
  | 'payments'
  | 'discounts'
  | 'reservations'
  | 'rentals'
  | 'housekeeping'
  | 'maintenance';

export const REPORTS: {
  kind: ReportKind;
  label: string;
  description: string;
  icon: LucideIcon;
  roles: Role[];
}[] = [
  {
    kind: 'occupancy',
    label: 'Ocupación',
    description: '% por día y por tipo, ADR y RevPAR',
    icon: BarChart3,
    roles: ['ADMIN'],
  },
  {
    kind: 'revenue',
    label: 'Ingresos',
    description: 'Devengado: hospedaje, extras y descuentos',
    icon: TrendingUp,
    roles: ['ADMIN'],
  },
  {
    kind: 'payments',
    label: 'Cobros',
    description: 'Cobrado por método, moneda y usuario',
    icon: Banknote,
    roles: ['ADMIN'],
  },
  {
    kind: 'discounts',
    label: 'Descuentos',
    description: 'Descuentos y condonaciones con autorización',
    icon: Percent,
    roles: ['ADMIN'],
  },
  {
    kind: 'reservations',
    label: 'Reservas',
    description: 'Cancelaciones, no-shows, estancia y anticipación',
    icon: CalendarRange,
    roles: ['ADMIN'],
  },
  {
    kind: 'rentals',
    label: 'Rentas por recepcionista',
    description: 'Check-ins de cada recepcionista',
    icon: BedDouble,
    roles: ['ADMIN', 'RECEPTION'],
  },
  {
    kind: 'housekeeping',
    label: 'Limpieza',
    description: 'Habitaciones limpiadas por usuario',
    icon: Sparkles,
    roles: ['ADMIN', 'RECEPTION', 'HOUSEKEEPING'],
  },
  {
    kind: 'maintenance',
    label: 'Mantenimiento',
    description: 'Tickets por habitación y tiempo de solución',
    icon: Wrench,
    roles: ['ADMIN'],
  },
];

export function useReport(kind: ReportKind, from: string, to: string) {
  return useQuery({
    queryKey: ['reports', kind, from, to],
    queryFn: async () =>
      (await api.get<Report>(`/reports/${kind}`, { params: { from, to } }))
        .data,
    enabled: !!from && !!to && from <= to,
    placeholderData: keepPreviousData,
  });
}

/** Descarga el reporte en Excel. */
export async function downloadReportXlsx(
  kind: ReportKind,
  from: string,
  to: string,
) {
  const res = await api.get<Blob>(`/reports/${kind}/xlsx`, {
    params: { from, to },
    responseType: 'blob',
  });
  const url = URL.createObjectURL(res.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${kind}_${from}_${to}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}
