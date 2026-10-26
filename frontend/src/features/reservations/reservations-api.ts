import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Paginated } from '@/features/users/users-api';
import type {
  AssignableRoom,
  CalendarData,
  FrontDesk,
  QuoteResult,
  Reservation,
  ReservationSource,
  ReservationStatus,
  StayInput,
} from './types';

const key = ['reservations'] as const;

export interface ReservationsQuery {
  page: number;
  limit: number;
  search?: string;
  status?: ReservationStatus;
  source?: ReservationSource;
  from?: string;
  to?: string;
  guestId?: string;
}

export interface ReservationInput extends StayInput {
  guestId: string;
  roomTypeId: string;
  source: ReservationSource;
  requiresDeposit?: boolean;
  notes?: string | null;
  taxProfileId?: string | null;
}

/** Disponibilidad y precio por tipo. Solo consulta cuando la estancia está completa. */
export function useQuote(stay: StayInput | null) {
  return useQuery({
    queryKey: [...key, 'quote', stay],
    queryFn: async () =>
      (await api.post<QuoteResult>('/reservations/quote', stay)).data,
    enabled: !!stay,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function useCalendar(from: string, days: number) {
  return useQuery({
    queryKey: [...key, 'calendar', from, days],
    queryFn: async () =>
      (
        await api.get<CalendarData>('/reservations/calendar', {
          params: { from, days },
        })
      ).data,
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
}

export function useReservations(query: ReservationsQuery, enabled = true) {
  return useQuery({
    queryKey: [...key, 'list', query],
    queryFn: async () =>
      (
        await api.get<Paginated<Reservation>>('/reservations', {
          params: query,
        })
      ).data,
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useReservation(id: string | null) {
  return useQuery({
    queryKey: [...key, 'detail', id],
    queryFn: async () =>
      (await api.get<Reservation>(`/reservations/${id}`)).data,
    enabled: !!id,
  });
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.invalidateQueries({ queryKey: key });
    // El check-in/out cambia el estado de las habitaciones.
    await queryClient.invalidateQueries({ queryKey: ['rooms'] });
  };
}

export function useSaveReservation() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: Partial<ReservationInput> & { id?: string }) =>
      id
        ? (await api.patch<Reservation>(`/reservations/${id}`, input)).data
        : (await api.post<Reservation>('/reservations', input)).data,
    onSuccess: invalidate,
  });
}

export function useCancelReservation() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) =>
      (await api.post<Reservation>(`/reservations/${id}/cancel`, { reason }))
        .data,
    onSuccess: invalidate,
  });
}

export function useNoShow() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.post<Reservation>(`/reservations/${id}/no-show`)).data,
    onSuccess: invalidate,
  });
}

// --- Recepción ---

export function useFrontDesk() {
  return useQuery({
    queryKey: [...key, 'front-desk'],
    queryFn: async () =>
      (await api.get<FrontDesk>('/reservations/front-desk')).data,
    refetchInterval: 30_000,
  });
}

export function useAvailableRooms(reservationId: string | null) {
  return useQuery({
    queryKey: [...key, 'available-rooms', reservationId],
    queryFn: async () =>
      (
        await api.get<AssignableRoom[]>(
          `/reservations/${reservationId}/available-rooms`,
        )
      ).data,
    enabled: !!reservationId,
  });
}

export function useCheckIn() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: {
      id: string;
      roomId: string;
      reason?: string;
      adults?: number;
      children?: number;
    }) =>
      (await api.post<Reservation>(`/reservations/${id}/check-in`, input)).data,
    onSuccess: invalidate,
  });
}

export function useWalkIn() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (
      input: ReservationInput & { roomId: string; reason?: string },
    ) => (await api.post<Reservation>('/reservations/walk-in', input)).data,
    onSuccess: invalidate,
  });
}

export function useMoveRoom() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({
      id,
      roomId,
      reason,
    }: {
      id: string;
      roomId: string;
      reason?: string;
    }) =>
      (
        await api.post<Reservation>(`/reservations/${id}/move`, {
          roomId,
          reason,
        })
      ).data,
    onSuccess: invalidate,
  });
}

export function useExtendStay() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: {
      id: string;
      departureDate?: string;
      units?: number;
    }) =>
      (await api.post<Reservation>(`/reservations/${id}/extend`, input)).data,
    onSuccess: invalidate,
  });
}

export function useCheckOut() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.post<Reservation>(`/reservations/${id}/check-out`)).data,
    onSuccess: invalidate,
  });
}

/** Cambiar la cantidad de personas (recalcula toda la estancia). */
export function useChangeGuests() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({
      id,
      adults,
      children,
    }: {
      id: string;
      adults: number;
      children: number;
    }) =>
      (
        await api.post<Reservation>(`/reservations/${id}/guests`, {
          adults,
          children,
        })
      ).data,
    onSuccess: invalidate,
  });
}
