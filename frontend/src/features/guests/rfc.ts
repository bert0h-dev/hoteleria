// Mismas reglas que backend/src/modules/catalogs/sat.ts (el backend valida
// de nuevo; aquí solo sirven para guiar al capturar).
import type { PersonType } from './types';

const RFC_PATTERN =
  /^([A-ZÑ&]{3,4})(\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])([A-Z\d]{2})([A\d])$/;

export const GENERIC_RFCS = {
  XAXX010101000: 'Público en general',
  XEXX010101000: 'Extranjero',
} as const;

export function normalizeRfc(rfc: string): string {
  return rfc.trim().toUpperCase().replace(/[\s-]/g, '');
}

export function isValidRfc(rfc: string): boolean {
  return RFC_PATTERN.test(normalizeRfc(rfc));
}

export function personTypeOf(rfc: string): PersonType {
  return normalizeRfc(rfc).length === 13 ? 'FISICA' : 'MORAL';
}

export function isGenericRfc(rfc: string): boolean {
  return normalizeRfc(rfc) in GENERIC_RFCS;
}
