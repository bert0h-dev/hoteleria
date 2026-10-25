import {
  BedDouble,
  Ban,
  CheckCircle2,
  Sparkles,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@/features/auth/types';
import type { RoomStatus } from './types';

interface StatusStyle {
  label: string;
  icon: LucideIcon;
  /** Punto / acento sólido. */
  dot: string;
  /** Insignia suave (fondo + texto + anillo). */
  badge: string;
  /** Tarjeta del tablero. */
  card: string;
}

// Colores fijos por estado: deben leerse igual con cualquier tema.
export const ROOM_STATUS: Record<RoomStatus, StatusStyle> = {
  AVAILABLE: {
    label: 'Disponible',
    icon: CheckCircle2,
    dot: 'bg-emerald-500',
    badge:
      'bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300',
    card: 'border-emerald-500/30 bg-emerald-500/[0.06] hover:border-emerald-500/60',
  },
  OCCUPIED: {
    label: 'Ocupada',
    icon: BedDouble,
    dot: 'bg-rose-500',
    badge: 'bg-rose-500/10 text-rose-700 ring-rose-500/25 dark:text-rose-300',
    card: 'border-rose-500/30 bg-rose-500/[0.06] hover:border-rose-500/60',
  },
  CLEANING: {
    label: 'Limpieza',
    icon: Sparkles,
    dot: 'bg-amber-500',
    badge:
      'bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-300',
    card: 'border-amber-500/30 bg-amber-500/[0.06] hover:border-amber-500/60',
  },
  MAINTENANCE: {
    label: 'Mantenimiento',
    icon: Wrench,
    dot: 'bg-sky-500',
    badge: 'bg-sky-500/10 text-sky-700 ring-sky-500/25 dark:text-sky-300',
    card: 'border-sky-500/30 bg-sky-500/[0.06] hover:border-sky-500/60',
  },
  OUT_OF_SERVICE: {
    label: 'Fuera de servicio',
    icon: Ban,
    dot: 'bg-zinc-400',
    badge: 'bg-zinc-500/10 text-zinc-700 ring-zinc-500/25 dark:text-zinc-300',
    card: 'border-zinc-500/30 bg-zinc-500/[0.06] opacity-80 hover:border-zinc-500/60',
  },
};

export const ROOM_STATUSES = Object.keys(ROOM_STATUS) as RoomStatus[];

// Mismas reglas que backend/src/modules/rooms/room-status.rules.ts
const HOUSEKEEPING_TRANSITIONS: [RoomStatus, RoomStatus][] = [
  ['AVAILABLE', 'CLEANING'],
  ['CLEANING', 'AVAILABLE'],
];

/** Estados a los que el rol puede mover una habitación desde `from`. */
export function allowedTargets(role: Role, from: RoomStatus): RoomStatus[] {
  if (role === 'HOUSEKEEPING') {
    return HOUSEKEEPING_TRANSITIONS.filter(([f]) => f === from).map(
      ([, to]) => to,
    );
  }
  return ROOM_STATUSES.filter((s) => s !== from);
}

export const requiresReason = (to: RoomStatus) =>
  to === 'MAINTENANCE' || to === 'OUT_OF_SERVICE';

export const completesCleaning = (from: RoomStatus, to: RoomStatus) =>
  from === 'CLEANING' && to === 'AVAILABLE';
