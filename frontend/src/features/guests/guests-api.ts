import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Paginated } from '@/features/users/users-api';
import type {
  DocumentType,
  DuplicateGuest,
  Guest,
  SatCatalogs,
  TaxProfile,
} from './types';

const guestsKey = ['guests'] as const;

export interface GuestsQuery {
  page: number;
  limit: number;
  search?: string;
  vip?: boolean;
  blocked?: boolean;
}

export interface GuestInput {
  firstName: string;
  lastName: string;
  birthDate?: string | null;
  nationality?: string | null;
  phone?: string | null;
  email?: string | null;
  documentType?: DocumentType | null;
  documentNumber?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  isVip?: boolean;
  notes?: string | null;
  privacyAccepted?: boolean;
}

export type TaxProfileInput = Omit<TaxProfile, 'id'>;

export function useGuests(query: GuestsQuery) {
  return useQuery({
    queryKey: [...guestsKey, 'list', query],
    queryFn: async () =>
      (await api.get<Paginated<Guest>>('/guests', { params: query })).data,
    placeholderData: keepPreviousData,
  });
}

export function useGuest(id: string | null | undefined) {
  return useQuery({
    queryKey: [...guestsKey, 'detail', id],
    queryFn: async () => (await api.get<Guest>(`/guests/${id}`)).data,
    enabled: !!id,
  });
}

/** Posibles duplicados por teléfono, correo o identificación. */
export function useGuestDuplicates(params: {
  phone?: string;
  email?: string;
  documentType?: DocumentType | null;
  documentNumber?: string;
  excludeId?: string;
}) {
  const enabled =
    (params.phone?.replace(/\D/g, '').length ?? 0) >= 7 ||
    /.+@.+\..+/.test(params.email ?? '') ||
    (!!params.documentType && (params.documentNumber?.length ?? 0) >= 4);
  return useQuery({
    queryKey: [...guestsKey, 'duplicates', params],
    queryFn: async () =>
      (
        await api.get<DuplicateGuest[]>('/guests/duplicates', {
          params: {
            ...params,
            documentType: params.documentType ?? undefined,
          },
        })
      ).data,
    enabled,
    staleTime: 10_000,
  });
}

function useOnGuestChanged() {
  const queryClient = useQueryClient();
  return (guest: Guest) => {
    queryClient.setQueryData([...guestsKey, 'detail', guest.id], guest);
    return queryClient.invalidateQueries({ queryKey: [...guestsKey, 'list'] });
  };
}

export function useSaveGuest() {
  const onChanged = useOnGuestChanged();
  return useMutation({
    mutationFn: async ({ id, ...input }: GuestInput & { id?: string }) =>
      id
        ? (await api.patch<Guest>(`/guests/${id}`, input)).data
        : (await api.post<Guest>('/guests', input)).data,
    onSuccess: onChanged,
  });
}

export function useBlockGuest() {
  const onChanged = useOnGuestChanged();
  return useMutation({
    mutationFn: async ({
      id,
      isBlocked,
      reason,
    }: {
      id: string;
      isBlocked: boolean;
      reason?: string;
    }) =>
      (await api.patch<Guest>(`/guests/${id}/block`, { isBlocked, reason }))
        .data,
    onSuccess: onChanged,
  });
}

export function useSaveTaxProfile(guestId: string) {
  const onChanged = useOnGuestChanged();
  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: Partial<TaxProfileInput> & { id?: string }) =>
      id
        ? (
            await api.patch<Guest>(
              `/guests/${guestId}/tax-profiles/${id}`,
              input,
            )
          ).data
        : (await api.post<Guest>(`/guests/${guestId}/tax-profiles`, input))
            .data,
    onSuccess: onChanged,
  });
}

export function useDeleteTaxProfile(guestId: string) {
  const onChanged = useOnGuestChanged();
  return useMutation({
    mutationFn: async (profileId: string) =>
      (await api.delete<Guest>(`/guests/${guestId}/tax-profiles/${profileId}`))
        .data,
    onSuccess: onChanged,
  });
}

export function useSatCatalogs() {
  return useQuery({
    queryKey: ['catalogs', 'sat'],
    queryFn: async () => (await api.get<SatCatalogs>('/catalogs/sat')).data,
    staleTime: Infinity,
  });
}
