import {
  CalendarCheck,
  CircleSlash,
  DoorOpen,
  LogOut,
  UserX,
  type LucideIcon,
} from 'lucide-react';
import type { Guest } from '@/features/guests/types';
import type { Amenity } from '@/features/rooms/types';
import type { NightPrice, TaxBreakdown } from '@/features/hotel/pricing';
import type { RatePeriod } from '@/features/hotel/rate-periods-api';

export type Modality = 'NIGHTLY' | 'DAILY' | 'HOURLY';
export type ReservationStatus =
  'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW';
export type ReservationSource = 'WALK_IN' | 'PHONE' | 'WHATSAPP' | 'OTHER';

export const MODALITIES: Record<
  Modality,
  { label: string; unit: [string, string] }
> = {
  NIGHTLY: { label: 'Por noche', unit: ['noche', 'noches'] },
  DAILY: { label: 'Por día', unit: ['día', 'días'] },
  HOURLY: { label: 'Por horas', unit: ['hora', 'horas'] },
};

export const SOURCES: Record<ReservationSource, string> = {
  WALK_IN: 'Mostrador',
  PHONE: 'Teléfono',
  WHATSAPP: 'WhatsApp',
  OTHER: 'Otro',
};

export const RESERVATION_STATUS: Record<
  ReservationStatus,
  { label: string; icon: LucideIcon; badge: string; bar: string }
> = {
  CONFIRMED: {
    label: 'Confirmada',
    icon: CalendarCheck,
    badge: 'bg-sky-500/10 text-sky-700 ring-sky-500/25 dark:text-sky-300',
    bar: 'bg-sky-500',
  },
  CHECKED_IN: {
    label: 'En casa',
    icon: DoorOpen,
    badge:
      'bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300',
    bar: 'bg-emerald-500',
  },
  CHECKED_OUT: {
    label: 'Salió',
    icon: LogOut,
    badge: 'bg-zinc-500/10 text-zinc-700 ring-zinc-500/25 dark:text-zinc-300',
    bar: 'bg-zinc-400',
  },
  CANCELLED: {
    label: 'Cancelada',
    icon: CircleSlash,
    badge: 'bg-rose-500/10 text-rose-700 ring-rose-500/25 dark:text-rose-300',
    bar: 'bg-rose-400',
  },
  NO_SHOW: {
    label: 'No se presentó',
    icon: UserX,
    badge:
      'bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-300',
    bar: 'bg-amber-500',
  },
};

export const unitLabel = (modality: Modality, n: number) =>
  `${n} ${MODALITIES[modality].unit[n === 1 ? 0 : 1]}`;

export interface QuoteDetail {
  modality: Modality;
  units: number;
  weeks?: number;
  extraNights?: number;
  billedHours?: number;
  cappedAtDay?: boolean;
  nights?: NightPrice[];
  rateDay?: NightPrice;
  extraAdults: number;
  extrasPerUnit: number;
  taxes: TaxBreakdown;
}

export interface Quote {
  nightlyRate: number;
  baseAmount: number;
  extrasAmount: number;
  totalAmount: number;
  detail: QuoteDetail;
}

export interface QuoteOption {
  roomType: {
    id: string;
    name: string;
    maxAdults: number;
    maxChildren: number;
    amenities: Amenity[];
  };
  sellable: number;
  booked: number;
  available: number;
  fitsGuests: boolean;
  quote: Quote;
}

export interface QuoteResult {
  checkIn: string;
  checkOut: string;
  units: number;
  options: QuoteOption[];
}

export interface StayInput {
  modality: Modality;
  arrivalDate: string;
  departureDate?: string;
  arrivalTime?: string;
  units?: number;
  adults: number;
  children: number;
}

export interface Reservation {
  id: string;
  code: string;
  modality: Modality;
  checkIn: string;
  checkOut: string;
  units: number;
  adults: number;
  children: number;
  source: ReservationSource;
  status: ReservationStatus;
  requiresDeposit: boolean;
  notes: string | null;
  nightlyRate: number;
  baseAmount: number;
  extrasAmount: number;
  totalAmount: number;
  pricing: QuoteDetail;
  roomTypeId: string;
  guestId: string;
  taxProfileId: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  noShowAt: string | null;
  createdAt: string;
  guest: Pick<
    Guest,
    'id' | 'firstName' | 'lastName' | 'phone' | 'email' | 'isVip' | 'isBlocked'
  >;
  roomType: { id: string; name: string };
  room: { id: string; number: string } | null;
  taxProfile: { id: string; rfc: string; legalName: string } | null;
  createdBy: { id: string; name: string };
  cancelledBy: { id: string; name: string } | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  checkedInBy: { id: string; name: string } | null;
  checkedOutBy: { id: string; name: string } | null;
  /** Tipo reservado originalmente (si hubo mejora de categoría). */
  bookedRoomType: { id: string; name: string } | null;
  upgradeReason: string | null;
  charges: StayCharge[];
}

export interface StayCharge {
  id: string;
  kind: 'EARLY_CHECK_IN' | 'LATE_CHECK_OUT';
  status: 'SUGGESTED' | 'CONFIRMED' | 'WAIVED';
  description: string;
  hours: number;
  amount: number;
  createdAt: string;
}

/** Habitación que se puede asignar en el check-in o un cambio. */
export interface AssignableRoom {
  id: string;
  number: string;
  floor: number;
  roomType: { id: string; name: string; nightlyRate: number };
  /** De otro tipo (mejora de categoría). */
  upgrade: boolean;
  assignable: boolean;
  lastCleanedAt: string | null;
}

export interface FrontDesk {
  today: string;
  arrivals: Reservation[];
  noShowCandidates: Reservation[];
  inHouse: (Reservation & {
    departsToday: boolean;
    overdue: boolean;
    /** Saldo pendiente en centavos (negativo: saldo a favor). */
    balanceCents: number;
  })[];
}

export interface CalendarDay {
  date: string;
  sellable: number;
  booked: number;
  available: number;
}

export interface CalendarData {
  days: string[];
  rows: {
    roomType: { id: string; name: string };
    total: number;
    days: CalendarDay[];
  }[];
  reservations: Reservation[];
  seasons: RatePeriod[];
  weekday: { days: number[]; percent: number };
}
