import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { RoomStatus } from '@/features/rooms/types';

interface Person {
  id: string;
  name: string;
}

export type CleaningKind = 'DEPARTURE' | 'STAYOVER';
export type CleaningStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';

export const CLEANING_KINDS: Record<CleaningKind, string> = {
  DEPARTURE: 'Salida',
  STAYOVER: 'Repaso',
};

export interface CleaningTask {
  id: string;
  kind: CleaningKind;
  status: CleaningStatus;
  isPriority: boolean;
  notes: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  room: {
    id: string;
    number: string;
    floor: number;
    status: RoomStatus;
    roomType: { name: string };
  };
  assignedTo: Person | null;
  requestedBy: Person;
  finishedBy: Person | null;
}

const key = ['cleaning-tasks'] as const;

export function useCleaningTasks(scope: 'active' | 'done' = 'active') {
  return useQuery({
    queryKey: [...key, scope],
    queryFn: async () =>
      (await api.get<CleaningTask[]>('/cleaning-tasks', { params: { scope } }))
        .data,
    refetchInterval: 30_000,
  });
}

function useTaskMutation<TInput>(
  request: (input: TInput) => Promise<CleaningTask>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: key });
      // Terminar una salida deja la habitación disponible.
      await queryClient.invalidateQueries({ queryKey: ['rooms'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useCreateStayover() {
  return useTaskMutation(
    async (input: {
      roomId: string;
      assignedToId?: string | null;
      isPriority?: boolean;
      notes?: string | null;
    }) => (await api.post<CleaningTask>('/cleaning-tasks', input)).data,
  );
}

export function useUpdateTask() {
  return useTaskMutation(
    async ({
      id,
      ...input
    }: {
      id: string;
      assignedToId?: string | null;
      isPriority?: boolean;
    }) => (await api.patch<CleaningTask>(`/cleaning-tasks/${id}`, input)).data,
  );
}

/** Tomar, empezar o terminar. */
export function useTaskAction() {
  return useTaskMutation(
    async ({
      id,
      action,
    }: {
      id: string;
      action: 'take' | 'start' | 'finish';
    }) =>
      (await api.post<CleaningTask>(`/cleaning-tasks/${id}/${action}`)).data,
  );
}

export function useCancelTask() {
  return useTaskMutation(
    async ({ id, reason }: { id: string; reason: string }) =>
      (
        await api.post<CleaningTask>(`/cleaning-tasks/${id}/cancel`, {
          reason,
        })
      ).data,
  );
}
