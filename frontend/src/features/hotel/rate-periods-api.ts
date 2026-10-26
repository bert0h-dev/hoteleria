import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type SeasonColor =
  'violet' | 'sky' | 'emerald' | 'amber' | 'rose' | 'orange' | 'teal' | 'slate';

export interface RatePeriod {
  id: string;
  name: string;
  /** YYYY-MM-DD, inclusive. */
  startDate: string;
  endDate: string;
  adjustmentPercent: number;
  priority: number;
  color: SeasonColor;
  isActive: boolean;
}

export type RatePeriodInput = Omit<RatePeriod, 'id'>;

// Colores fijos para que se distingan con cualquier tema.
export const SEASON_COLORS: Record<
  SeasonColor,
  { label: string; dot: string; soft: string }
> = {
  violet: {
    label: 'Violeta',
    dot: 'bg-violet-500',
    soft: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  },
  sky: {
    label: 'Azul',
    dot: 'bg-sky-500',
    soft: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  },
  emerald: {
    label: 'Verde',
    dot: 'bg-emerald-500',
    soft: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  },
  amber: {
    label: 'Ámbar',
    dot: 'bg-amber-500',
    soft: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  },
  rose: {
    label: 'Rosa',
    dot: 'bg-rose-500',
    soft: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  },
  orange: {
    label: 'Naranja',
    dot: 'bg-orange-500',
    soft: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  },
  teal: {
    label: 'Turquesa',
    dot: 'bg-teal-500',
    soft: 'bg-teal-500/15 text-teal-700 dark:text-teal-300',
  },
  slate: {
    label: 'Gris',
    dot: 'bg-slate-500',
    soft: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  },
};

/** "+30 %" / "−15 %". */
export const formatPercent = (n: number) =>
  `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)} %`;

const key = ['rate-periods'] as const;

export function useRatePeriods() {
  return useQuery({
    queryKey: key,
    queryFn: async () => (await api.get<RatePeriod[]>('/rate-periods')).data,
  });
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.invalidateQueries({ queryKey: key });
    // Las cotizaciones y el calendario dependen de las temporadas.
    await queryClient.invalidateQueries({ queryKey: ['reservations'] });
  };
}

export function useSaveRatePeriod() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: Partial<RatePeriodInput> & { id?: string }) =>
      id
        ? (await api.patch<RatePeriod>(`/rate-periods/${id}`, input)).data
        : (await api.post<RatePeriod>('/rate-periods', input)).data,
    onSuccess: invalidate,
  });
}

export function useDeleteRatePeriod() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/rate-periods/${id}`);
    },
    onSuccess: invalidate,
  });
}
