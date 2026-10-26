export type Role = 'ADMIN' | 'RECEPTION' | 'HOUSEKEEPING';

export interface User {
  id: string;
  hotelId: string;
  name: string;
  email: string;
  phone: string | null;
  employeeNumber: string | null;
  /** Fecha de ingreso laboral (ISO; solo importa la parte YYYY-MM-DD). */
  hireDate: string | null;
  role: Role;
  /** Puede autorizar con su PIN. */
  canAuthorize: boolean;
  /** Aplica descuentos sin límite ni autorización. */
  canDiscountUnlimited: boolean;
  /** Solo en /auth/me: si ya configuró su PIN. */
  hasAuthPin?: boolean;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}
