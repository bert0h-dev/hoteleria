import type { Prisma } from '../../generated/prisma/client.js';

/** Campos públicos de un usuario (nunca incluye passwordHash). */
export const userSelect = {
  id: true,
  hotelId: true,
  name: true,
  email: true,
  phone: true,
  employeeNumber: true,
  hireDate: true,
  role: true,
  canAuthorize: true,
  canDiscountUnlimited: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof userSelect }>;
