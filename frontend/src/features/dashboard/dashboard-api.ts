import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { RoomStatus } from '@/features/rooms/types';

export interface DashboardRooms {
  total: number;
  sellable: number;
  byStatus: Record<RoomStatus, number>;
  toClean: {
    id: string;
    number: string;
    floor: number;
    roomType: string;
    since: string;
  }[];
  overdueBlocks: number;
}

export interface ForecastDay {
  date: string;
  sellable: number;
  booked: number;
  percent: number;
}

export interface DashboardAlert {
  kind: string;
  severity: 'warning' | 'danger' | 'info';
  text: string;
  link?: string;
}

export interface Dashboard {
  today: string;
  rooms: DashboardRooms;
  /** Solo Limpieza. */
  cleanedToday?: number;
  occupancy?: { occupied: number; sellable: number; percent: number };
  frontDesk?: {
    arrivals: number;
    departures: number;
    overdue: number;
    inHouse: number;
    guests: number;
  };
  money?: {
    collectedTodayCents: number;
    receivablesCents: number;
    receivablesCount: number;
  };
  forecast?: ForecastDay[];
  alerts?: DashboardAlert[];
}

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => (await api.get<Dashboard>('/dashboard')).data,
    refetchInterval: 60_000,
  });
}
