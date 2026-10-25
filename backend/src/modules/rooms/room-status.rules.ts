import type { Role, RoomStatus } from '../../generated/prisma/enums.js';

/**
 * Cambios de estado que puede hacer el personal de limpieza. ADMIN y
 * RECEPTION pueden hacer cualquier cambio.
 */
const HOUSEKEEPING_TRANSITIONS: ReadonlyArray<[RoomStatus, RoomStatus]> = [
  ['AVAILABLE', 'CLEANING'],
  ['CLEANING', 'AVAILABLE'],
];

export function canChangeStatus(
  role: Role,
  from: RoomStatus,
  to: RoomStatus,
): boolean {
  if (role === 'ADMIN' || role === 'RECEPTION') return true;
  if (role === 'HOUSEKEEPING') {
    return HOUSEKEEPING_TRANSITIONS.some(([f, t]) => f === from && t === to);
  }
  return false;
}

/** Estados que exigen explicar el motivo del cambio. */
export function requiresReason(to: RoomStatus): boolean {
  return to === 'MAINTENANCE' || to === 'OUT_OF_SERVICE';
}

/** Un cambio de LIMPIEZA a DISPONIBLE significa que se terminó de limpiar. */
export function completesCleaning(from: RoomStatus, to: RoomStatus): boolean {
  return from === 'CLEANING' && to === 'AVAILABLE';
}

export const ROOM_STATUS_LABELS: Record<RoomStatus, string> = {
  AVAILABLE: 'Disponible',
  OCCUPIED: 'Ocupada',
  CLEANING: 'Limpieza',
  MAINTENANCE: 'Mantenimiento',
  OUT_OF_SERVICE: 'Fuera de servicio',
};
