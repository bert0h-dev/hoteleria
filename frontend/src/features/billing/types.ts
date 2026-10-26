import type {
  ReservationStatus,
  StayCharge,
} from '@/features/reservations/types';

export type PaymentMethod =
  'CASH' | 'DEBIT_CARD' | 'CREDIT_CARD' | 'TRANSFER' | 'OTHER';
export type Currency = 'MXN' | 'USD';

export const PAYMENT_METHODS: Record<PaymentMethod, string> = {
  CASH: 'Efectivo',
  DEBIT_CARD: 'Tarjeta de débito',
  CREDIT_CARD: 'Tarjeta de crédito',
  TRANSFER: 'Transferencia',
  OTHER: 'Otro',
};

interface Person {
  id: string;
  name: string;
}

export interface FolioEntry {
  id: string;
  kind: 'CHARGE' | 'DISCOUNT';
  description: string;
  quantity: number;
  unitPriceCents: number;
  amountCents: number;
  reason: string | null;
  stayChargeId: string | null;
  createdAt: string;
  createdBy: Person;
  authorizedBy: Person | null;
  voided: boolean;
  voidReason: string | null;
  voidedBy: Person | null;
}

export interface Payment {
  id: string;
  receiptNumber: string;
  kind: 'PAYMENT' | 'REFUND';
  method: PaymentMethod;
  currency: Currency;
  amountCents: number;
  exchangeRate: number | null;
  amountMxnCents: number;
  reference: string | null;
  isDeposit: boolean;
  notes: string | null;
  createdAt: string;
  createdBy: Person;
  voided: boolean;
  voidReason: string | null;
  voidedBy: Person | null;
}

export interface FolioTotals {
  lodgingCents: number;
  chargesCents: number;
  grossCents: number;
  discountsCents: number;
  netCents: number;
  paidCents: number;
  refundedCents: number;
  balanceCents: number;
}

export interface Folio {
  reservation: {
    id: string;
    code: string;
    status: ReservationStatus;
    requiresDeposit: boolean;
    guest: { id: string; firstName: string; lastName: string };
    room: { number: string } | null;
    balanceDueCents: number | null;
    balanceReason: string | null;
    balanceAuthorizedBy: Person | null;
  };
  totals: FolioTotals;
  depositPaid: boolean;
  discountCap: { percent: number; capCents: number; usedCents: number };
  entries: FolioEntry[];
  payments: Payment[];
  stayCharges: (StayCharge & {
    waiveReason: string | null;
    resolvedBy: Person | null;
    authorizedBy: Person | null;
  })[];
}

export interface ChargeConcept {
  id: string;
  name: string;
  category: string | null;
  priceCents: number;
  isActive: boolean;
}

export interface TodayRate {
  date: string;
  rate: number | null;
  createdBy: Person | null;
}

export interface Authorizer {
  id: string;
  name: string;
  role: 'ADMIN' | 'RECEPTION' | 'HOUSEKEEPING';
  hasPin: boolean;
}

/** Lo que se manda cuando una operación requiere autorización. */
export interface Authorization {
  authorizerId: string;
  pin: string;
}
