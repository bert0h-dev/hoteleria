import {
  canChangeStatus,
  completesCleaning,
  isBlockingStatus,
  requiresBlockedUntil,
  requiresReason,
} from './room-status.rules.js';

describe('reglas de estado de habitación', () => {
  it('ADMIN y RECEPTION pueden hacer cualquier cambio', () => {
    expect(canChangeStatus('ADMIN', 'AVAILABLE', 'OUT_OF_SERVICE')).toBe(true);
    expect(canChangeStatus('RECEPTION', 'MAINTENANCE', 'AVAILABLE')).toBe(true);
  });

  it('limpieza solo puede iniciar y terminar limpiezas', () => {
    expect(canChangeStatus('HOUSEKEEPING', 'AVAILABLE', 'CLEANING')).toBe(true);
    expect(canChangeStatus('HOUSEKEEPING', 'CLEANING', 'AVAILABLE')).toBe(true);
    expect(canChangeStatus('HOUSEKEEPING', 'OCCUPIED', 'CLEANING')).toBe(false);
    expect(canChangeStatus('HOUSEKEEPING', 'AVAILABLE', 'MAINTENANCE')).toBe(
      false,
    );
  });

  it('mantenimiento y fuera de servicio exigen motivo', () => {
    expect(requiresReason('MAINTENANCE')).toBe(true);
    expect(requiresReason('OUT_OF_SERVICE')).toBe(true);
    expect(requiresReason('CLEANING')).toBe(false);
  });

  it('mantenimiento exige fecha; fuera de servicio puede ser indefinido', () => {
    expect(requiresBlockedUntil('MAINTENANCE')).toBe(true);
    expect(requiresBlockedUntil('OUT_OF_SERVICE')).toBe(false);
    expect(isBlockingStatus('OUT_OF_SERVICE')).toBe(true);
    expect(isBlockingStatus('CLEANING')).toBe(false);
  });

  it('solo CLEANING → AVAILABLE cuenta como limpieza terminada', () => {
    expect(completesCleaning('CLEANING', 'AVAILABLE')).toBe(true);
    expect(completesCleaning('CLEANING', 'MAINTENANCE')).toBe(false);
    expect(completesCleaning('AVAILABLE', 'CLEANING')).toBe(false);
  });
});
