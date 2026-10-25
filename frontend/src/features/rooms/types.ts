import type { Rates } from '@/features/hotel/pricing';

export type RoomStatus =
  'AVAILABLE' | 'OCCUPIED' | 'CLEANING' | 'MAINTENANCE' | 'OUT_OF_SERVICE';

export type Amenity =
  | 'WIFI'
  | 'AIR_CONDITIONING'
  | 'TV'
  | 'MINIBAR'
  | 'JACUZZI'
  | 'SEA_VIEW'
  | 'BALCONY'
  | 'SAFE'
  | 'COFFEE_MAKER'
  | 'WORKSPACE'
  | 'PARKING'
  | 'PET_FRIENDLY';

export interface RoomType {
  id: string;
  name: string;
  description: string | null;
  maxAdults: number;
  maxChildren: number;
  nightlyRate: number;
  amenities: Amenity[];
  isActive: boolean;
  rates: Rates;
  roomCount?: number;
}

interface Person {
  id: string;
  name: string;
}

export interface Room {
  id: string;
  number: string;
  floor: number;
  status: RoomStatus;
  notes: string | null;
  isActive: boolean;
  lastCleanedAt: string | null;
  lastCleanedBy: Person | null;
  roomType: Pick<RoomType, 'id' | 'name' | 'nightlyRate'>;
}

export interface RoomStatusLog {
  id: string;
  fromStatus: RoomStatus;
  toStatus: RoomStatus;
  reason: string | null;
  createdAt: string;
  cleanedAt: string | null;
  changedBy: Person;
  cleanedBy: Person | null;
}

export interface RoomSummary {
  total: number;
  byStatus: Record<RoomStatus, number>;
}
