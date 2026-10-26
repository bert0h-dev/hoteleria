import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  Authorization,
  Authorizer,
  ChargeConcept,
  Currency,
  Folio,
  PaymentMethod,
  TodayRate,
} from './types';

const keys = {
  folio: (id: string | null | undefined) => ['folio', id] as const,
  concepts: ['charge-concepts'] as const,
  rate: ['exchange-rate', 'today'] as const,
};

export function useFolio(reservationId: string | null | undefined) {
  return useQuery({
    queryKey: keys.folio(reservationId),
    queryFn: async () =>
      (await api.get<Folio>(`/reservations/${reservationId}/folio`)).data,
    enabled: !!reservationId,
  });
}

/** Mutación que devuelve el folio actualizado y refresca lo que depende de él. */
function useFolioMutation<TInput>(
  reservationId: string,
  request: (input: TInput) => Promise<Folio>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: async (folio) => {
      queryClient.setQueryData(keys.folio(reservationId), folio);
      // Recepción muestra saldos.
      await queryClient.invalidateQueries({ queryKey: ['reservations'] });
    },
  });
}

export function useAddCharge(reservationId: string) {
  return useFolioMutation(
    reservationId,
    async (input: {
      conceptId?: string;
      description?: string;
      quantity?: number;
      unitPrice?: number;
    }) =>
      (
        await api.post<Folio>(
          `/reservations/${reservationId}/folio/charges`,
          input,
        )
      ).data,
  );
}

export function useAddDiscount(reservationId: string) {
  return useFolioMutation(
    reservationId,
    async (input: {
      amount?: number;
      percent?: number;
      reason: string;
      authorization?: Authorization;
    }) =>
      (
        await api.post<Folio>(
          `/reservations/${reservationId}/folio/discounts`,
          input,
        )
      ).data,
  );
}

export function useResolveStayCharge(reservationId: string) {
  return useFolioMutation(
    reservationId,
    async ({
      chargeId,
      ...input
    }: {
      chargeId: string;
      action: 'CONFIRM' | 'WAIVE';
      reason?: string;
      authorization?: Authorization;
    }) =>
      (
        await api.post<Folio>(
          `/reservations/${reservationId}/stay-charges/${chargeId}/resolve`,
          input,
        )
      ).data,
  );
}

export function useAddPayment(reservationId: string) {
  return useFolioMutation(
    reservationId,
    async (input: {
      method: PaymentMethod;
      currency: Currency;
      amount: number;
      reference?: string | null;
      notes?: string | null;
    }) =>
      (await api.post<Folio>(`/reservations/${reservationId}/payments`, input))
        .data,
  );
}

export function useRefund(reservationId: string) {
  return useFolioMutation(
    reservationId,
    async (input: { method: PaymentMethod; amount: number; reason: string }) =>
      (await api.post<Folio>(`/reservations/${reservationId}/refunds`, input))
        .data,
  );
}

export function useVoid(reservationId: string) {
  return useFolioMutation(
    reservationId,
    async ({
      type,
      id,
      reason,
    }: {
      type: 'payment' | 'entry';
      id: string;
      reason: string;
    }) =>
      (
        await api.post<Folio>(
          type === 'payment'
            ? `/reservations/${reservationId}/payments/${id}/void`
            : `/reservations/${reservationId}/folio/entries/${id}/void`,
          { reason },
        )
      ).data,
  );
}

// --- Catálogo de conceptos ---

export function useConcepts(includeInactive = false) {
  return useQuery({
    queryKey: [...keys.concepts, { includeInactive }],
    queryFn: async () =>
      (
        await api.get<ChargeConcept[]>('/charge-concepts', {
          params: includeInactive ? { includeInactive } : undefined,
        })
      ).data,
  });
}

export function useSaveConcept() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: {
      id?: string;
      name?: string;
      category?: string | null;
      price?: number;
      isActive?: boolean;
    }) =>
      id
        ? (await api.patch<ChargeConcept>(`/charge-concepts/${id}`, input)).data
        : (await api.post<ChargeConcept>('/charge-concepts', input)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.concepts }),
  });
}

// --- Tipo de cambio ---

export function useTodayRate(enabled = true) {
  return useQuery({
    queryKey: keys.rate,
    queryFn: async () =>
      (await api.get<TodayRate>('/exchange-rates/today')).data,
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useSetTodayRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rate: number) =>
      (await api.put<TodayRate>('/exchange-rates/today', { rate })).data,
    onSuccess: (data) => queryClient.setQueryData(keys.rate, data),
  });
}

export function useRateHistory() {
  return useQuery({
    queryKey: ['exchange-rate', 'history'],
    queryFn: async () =>
      (
        await api.get<
          {
            id: string;
            date: string;
            rate: number;
            createdBy: { name: string };
          }[]
        >('/exchange-rates')
      ).data,
  });
}

// --- Autorización ---

export function useAuthorizers(enabled: boolean) {
  return useQuery({
    queryKey: ['authorizers'],
    queryFn: async () =>
      (await api.get<Authorizer[]>('/auth/authorizers')).data,
    enabled,
  });
}

export function useSetPin() {
  return useMutation({
    mutationFn: async (input: { currentPassword: string; pin: string }) => {
      await api.patch('/auth/me/pin', input);
    },
  });
}
