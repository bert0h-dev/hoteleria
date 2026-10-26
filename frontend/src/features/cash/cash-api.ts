import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Paginated } from '@/features/users/users-api';
import type { AuditLog, CashShift, Receivable, ShiftDetail } from './types';

export const cashKey = ['cash'] as const;

/** Mi turno abierto (null si no tengo). */
export function useCurrentShift(enabled = true) {
  return useQuery({
    queryKey: [...cashKey, 'current'],
    queryFn: async () =>
      ((await api.get<CashShift | ''>('/cash-shifts/current')).data ||
        null) as CashShift | null,
    enabled,
    refetchInterval: 60_000,
  });
}

export function useShift(id: string | null | undefined) {
  return useQuery({
    queryKey: [...cashKey, 'detail', id],
    queryFn: async () =>
      (await api.get<ShiftDetail>(`/cash-shifts/${id}`)).data,
    enabled: !!id,
  });
}

export function useShifts(query: {
  page: number;
  limit: number;
  status?: 'open' | 'closed';
}) {
  return useQuery({
    queryKey: [...cashKey, 'list', query],
    queryFn: async () =>
      (await api.get<Paginated<CashShift>>('/cash-shifts', { params: query }))
        .data,
    placeholderData: keepPreviousData,
  });
}

function useInvalidateCash() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: cashKey });
}

export function useOpenShift() {
  const invalidate = useInvalidateCash();
  return useMutation({
    mutationFn: async (input: { openingMxn: number; openingUsd: number }) =>
      (await api.post<CashShift>('/cash-shifts', input)).data,
    onSuccess: invalidate,
  });
}

export function useCloseShift() {
  const invalidate = useInvalidateCash();
  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: {
      id: string;
      countedMxn: number;
      countedUsd: number;
      notes?: string | null;
    }) => (await api.post<ShiftDetail>(`/cash-shifts/${id}/close`, input)).data,
    onSuccess: invalidate,
  });
}

export function useReceivables() {
  return useQuery({
    queryKey: [...cashKey, 'receivables'],
    queryFn: async () => (await api.get<Receivable[]>('/receivables')).data,
  });
}

export function useAuditLogs(query: {
  page: number;
  limit: number;
  search?: string;
  entity?: string;
}) {
  return useQuery({
    queryKey: ['audit-logs', query],
    queryFn: async () =>
      (await api.get<Paginated<AuditLog>>('/audit-logs', { params: query }))
        .data,
    placeholderData: keepPreviousData,
  });
}
