import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { PricingSettings, TaxSettings } from './pricing';

export interface HotelSettings extends PricingSettings, TaxSettings {
  hotelId: string;
  childMaxAge: number;
  weekdayAdjustDays: number[];
  weekdayAdjustPercent: number;
  checkInTime: string;
  checkOutTime: string;
  updatedAt: string;
}

export interface Hotel {
  id: string;
  name: string;
  legalName: string | null;
  taxId: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  timezone: string;
  currency: string;
  settings: HotelSettings;
}

export type UpdateHotelInput = Partial<
  Pick<
    Hotel,
    'name' | 'legalName' | 'taxId' | 'address' | 'phone' | 'email' | 'timezone'
  >
>;

export type UpdateSettingsInput = Partial<
  Omit<HotelSettings, 'hotelId' | 'updatedAt'>
>;

const hotelKey = ['hotel'] as const;

export function useHotel() {
  return useQuery({
    queryKey: hotelKey,
    queryFn: async () => (await api.get<Hotel>('/hotel')).data,
    staleTime: 5 * 60_000,
  });
}

export function useUpdateHotel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateHotelInput) =>
      (await api.patch<Hotel>('/hotel', input)).data,
    onSuccess: (hotel) => queryClient.setQueryData(hotelKey, hotel),
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateSettingsInput) =>
      (await api.patch<HotelSettings>('/hotel/settings', input)).data,
    onSuccess: async () => {
      // Las tarifas de los tipos dependen de la configuración.
      await queryClient.invalidateQueries({ queryKey: hotelKey });
      await queryClient.invalidateQueries({ queryKey: ['room-types'] });
    },
  });
}
