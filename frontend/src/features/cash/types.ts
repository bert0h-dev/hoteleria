import type {
  Currency,
  Payment,
  PaymentMethod,
} from '@/features/billing/types';

interface Person {
  id: string;
  name: string;
}

export interface MethodTotal {
  method: PaymentMethod;
  currency: Currency;
  /** En la moneda del pago (centavos). */
  paymentsCents: number;
  refundsCents: number;
  /** Neto en pesos (centavos). */
  netMxnCents: number;
  count: number;
}

export interface ShiftTotals {
  byMethod: MethodTotal[];
  netMxnCents: number;
  expectedMxnCents: number;
  expectedUsdCents: number;
  voidedCount: number;
}

export interface CashShift {
  id: string;
  userId: string;
  openedAt: string;
  openingMxnCents: number;
  openingUsdCents: number;
  closedAt: string | null;
  expectedMxnCents: number | null;
  expectedUsdCents: number | null;
  countedMxnCents: number | null;
  countedUsdCents: number | null;
  closingNotes: string | null;
  user: Person;
  closedBy?: Person | null;
  totals?: ShiftTotals;
  _count?: { payments: number };
}

export interface ShiftPayment extends Omit<Payment, 'voided' | 'createdBy'> {
  voidedAt: string | null;
  reservation: {
    id: string;
    code: string;
    guest: { firstName: string; lastName: string };
  };
}

export interface ShiftDetail extends CashShift {
  totals: ShiftTotals;
  payments: ShiftPayment[];
}

export interface Receivable {
  id: string;
  code: string;
  checkedOutAt: string;
  balanceDueCents: number;
  balanceCents: number;
  balanceReason: string | null;
  guest: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
  };
  room: { id: string; number: string } | null;
  balanceAuthorizedBy: Person | null;
  checkedOutBy: Person | null;
}

export interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  summary: string;
  data: unknown;
  createdAt: string;
  actor: Person;
  authorizedBy: Person | null;
}

export const AUDIT_ENTITIES: Record<string, string> = {
  reservation: 'Reservas y cobros',
  cash_shift: 'Caja',
  exchange_rate: 'Tipo de cambio',
  user: 'Usuarios',
  hotel: 'Datos del hotel',
  hotel_settings: 'Configuración',
  room_type: 'Tipos de habitación',
  rate_period: 'Temporadas',
};
