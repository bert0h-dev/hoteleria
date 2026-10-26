import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  Amenity,
  Room,
  RoomStatus,
  RoomStatusLog,
  RoomSummary,
  RoomType,
} from './types';

// Para ver los cambios de otros usuarios sin recargar.
const LIVE_REFRESH = 30_000;

const keys = {
  rooms: ['rooms'] as const,
  roomTypes: ['room-types'] as const,
};

// --- Tipos de habitación ---

export interface RoomTypeInput {
  name: string;
  description?: string | null;
  maxAdults: number;
  maxChildren: number;
  nightlyRate: number;
  includedAdults: number;
  extraAdultRate: number;
  extraChildRate: number;
  amenities: Amenity[];
  isActive?: boolean;
}

export function useRoomTypes(includeInactive = false) {
  return useQuery({
    queryKey: [...keys.roomTypes, { includeInactive }],
    queryFn: async () =>
      (
        await api.get<RoomType[]>('/room-types', {
          params: includeInactive ? { includeInactive } : undefined,
        })
      ).data,
  });
}

export function useSaveRoomType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: Partial<RoomTypeInput> & { id?: string }) =>
      id
        ? (await api.patch<RoomType>(`/room-types/${id}`, input)).data
        : (await api.post<RoomType>('/room-types', input)).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: keys.roomTypes });
      await queryClient.invalidateQueries({ queryKey: keys.rooms });
    },
  });
}

// --- Habitaciones ---

export interface RoomsQuery {
  status?: RoomStatus;
  floor?: number;
  roomTypeId?: string;
  search?: string;
  includeInactive?: boolean;
  overdue?: boolean;
}

export function useRooms(query: RoomsQuery, options?: { enabled?: boolean }) {
  return useQuery({
    enabled: options?.enabled ?? true,
    queryKey: [...keys.rooms, 'list', query],
    queryFn: async () =>
      (await api.get<Room[]>('/rooms', { params: query })).data,
    placeholderData: keepPreviousData,
    refetchInterval: LIVE_REFRESH,
  });
}

export function useRoomSummary() {
  return useQuery({
    queryKey: [...keys.rooms, 'summary'],
    queryFn: async () => (await api.get<RoomSummary>('/rooms/summary')).data,
    refetchInterval: LIVE_REFRESH,
  });
}

export function useRoomHistory(roomId: string | undefined) {
  return useQuery({
    queryKey: [...keys.rooms, 'history', roomId],
    queryFn: async () =>
      (await api.get<RoomStatusLog[]>(`/rooms/${roomId}/history`)).data,
    enabled: !!roomId,
  });
}

export function useHousekeepers(enabled: boolean) {
  return useQuery({
    queryKey: ['housekeepers'],
    queryFn: async () =>
      (await api.get<{ id: string; name: string }[]>('/rooms/housekeepers'))
        .data,
    enabled,
    staleTime: 5 * 60_000,
  });
}

export interface RoomInput {
  number: string;
  floor: number;
  roomTypeId: string;
  notes?: string | null;
  isActive?: boolean;
}

export function useSaveRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: Partial<RoomInput> & { id?: string }) =>
      id
        ? (await api.patch<Room>(`/rooms/${id}`, input)).data
        : (await api.post<Room>('/rooms', input)).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: keys.rooms });
      await queryClient.invalidateQueries({ queryKey: keys.roomTypes });
    },
  });
}

export function useChangeRoomStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: {
      id: string;
      status: RoomStatus;
      reason?: string;
      cleanedById?: string;
      blockedUntil?: string;
    }) => (await api.patch<Room>(`/rooms/${id}/status`, input)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.rooms }),
  });
}

export function useUpdateBlockedUntil() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      blockedUntil,
    }: {
      id: string;
      blockedUntil: string | null;
    }) =>
      (await api.patch<Room>(`/rooms/${id}/blocked-until`, { blockedUntil }))
        .data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.rooms }),
  });
}
