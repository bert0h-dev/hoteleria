import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { RoomStatus } from '@/features/rooms/types';

interface Person {
  id: string;
  name: string;
}

export type TicketPriority = 'LOW' | 'MEDIUM' | 'URGENT';
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CANCELLED';

export const PRIORITIES: Record<
  TicketPriority,
  { label: string; className: string }
> = {
  LOW: {
    label: 'Baja',
    className: 'bg-zinc-500/10 text-zinc-700 dark:text-zinc-300',
  },
  MEDIUM: {
    label: 'Media',
    className: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  },
  URGENT: {
    label: 'Urgente',
    className: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  },
};

export const TICKET_STATUS: Record<TicketStatus, string> = {
  OPEN: 'Abierto',
  IN_PROGRESS: 'En proceso',
  RESOLVED: 'Resuelto',
  CANCELLED: 'Cancelado',
};

export interface Ticket {
  id: string;
  area: string | null;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  blocksRoom: boolean;
  createdAt: string;
  startedAt: string | null;
  resolvedAt: string | null;
  fixedBy: string | null;
  resolution: string | null;
  cancelReason: string | null;
  room: {
    id: string;
    number: string;
    floor: number;
    status: RoomStatus;
  } | null;
  reportedBy: Person;
  resolvedBy: Person | null;
  roomReleased?: boolean;
}

const key = ['maintenance-tickets'] as const;

export function useTickets(status: 'open' | 'closed') {
  return useQuery({
    queryKey: [...key, status],
    queryFn: async () =>
      (await api.get<Ticket[]>('/maintenance-tickets', { params: { status } }))
        .data,
    refetchInterval: 60_000,
  });
}

function useTicketMutation<TInput>(
  request: (input: TInput) => Promise<Ticket>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: key });
      // Bloquear o liberar cambia habitaciones, limpiezas y el tablero.
      await queryClient.invalidateQueries({ queryKey: ['rooms'] });
      await queryClient.invalidateQueries({ queryKey: ['cleaning-tasks'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export interface TicketInput {
  roomId?: string | null;
  area?: string | null;
  description: string;
  priority: TicketPriority;
  blocksRoom?: boolean;
  blockedUntil?: string;
}

export function useCreateTicket() {
  return useTicketMutation(
    async (input: TicketInput) =>
      (await api.post<Ticket>('/maintenance-tickets', input)).data,
  );
}

export function useStartTicket() {
  return useTicketMutation(
    async (id: string) =>
      (await api.post<Ticket>(`/maintenance-tickets/${id}/start`)).data,
  );
}

export function useResolveTicket() {
  return useTicketMutation(
    async ({
      id,
      ...input
    }: {
      id: string;
      resolution: string;
      fixedBy: string;
    }) =>
      (await api.post<Ticket>(`/maintenance-tickets/${id}/resolve`, input))
        .data,
  );
}

export function useCancelTicket() {
  return useTicketMutation(
    async ({ id, reason }: { id: string; reason: string }) =>
      (
        await api.post<Ticket>(`/maintenance-tickets/${id}/cancel`, {
          reason,
        })
      ).data,
  );
}
