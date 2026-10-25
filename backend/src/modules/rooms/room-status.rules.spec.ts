import { canChangeStatus, completesCleaning } from './room-status.rules.js';

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

  it('solo CLEANING → AVAILABLE cuenta como limpieza terminada', () => {
    expect(completesCleaning('CLEANING', 'AVAILABLE')).toBe(true);
    expect(completesCleaning('CLEANING', 'MAINTENANCE')).toBe(false);
    expect(completesCleaning('AVAILABLE', 'CLEANING')).toBe(false);
  });
});
