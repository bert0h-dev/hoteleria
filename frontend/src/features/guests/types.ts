export type DocumentType = 'INE' | 'PASSPORT' | 'DRIVER_LICENSE' | 'OTHER';

export const DOCUMENT_TYPES: Record<DocumentType, string> = {
  INE: 'INE',
  PASSPORT: 'Pasaporte',
  DRIVER_LICENSE: 'Licencia de conducir',
  OTHER: 'Otra',
};

export interface TaxProfile {
  id: string;
  rfc: string;
  legalName: string;
  taxRegime: string;
  zipCode: string;
  cfdiUse: string;
  invoiceEmail: string | null;
  isDefault: boolean;
}

export interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  /** YYYY-MM-DD */
  birthDate: string | null;
  nationality: string | null;
  phone: string | null;
  email: string | null;
  documentType: DocumentType | null;
  documentNumber: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  isVip: boolean;
  isBlocked: boolean;
  blockedReason: string | null;
  notes: string | null;
  privacyAcceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
  taxProfileCount?: number;
  taxProfiles?: TaxProfile[];
}

export type DuplicateReason = 'phone' | 'email' | 'document';

export interface DuplicateGuest extends Guest {
  reasons: DuplicateReason[];
}

export interface SatCatalogs {
  taxRegimes: { code: string; name: string; appliesTo: PersonType[] }[];
  cfdiUses: { code: string; name: string; appliesTo: PersonType[] }[];
}

export type PersonType = 'FISICA' | 'MORAL';

export const fullName = (g: Pick<Guest, 'firstName' | 'lastName'>) =>
  `${g.firstName} ${g.lastName}`;
