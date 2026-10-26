import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 8;

export const nameField = z
  .string()
  .trim()
  .min(1, 'Escribe el nombre')
  .max(120, 'El nombre no puede pasar de 120 caracteres');

const role = z.enum(['ADMIN', 'RECEPTION', 'HOUSEKEEPING'], {
  error: 'Selecciona un rol',
});

export const passwordField = z
  .string()
  .min(
    PASSWORD_MIN_LENGTH,
    `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`,
  )
  .max(128, 'La contraseña no puede pasar de 128 caracteres');

/** Opcional: vacío o un teléfono válido. */
export const phoneField = z
  .string()
  .trim()
  .refine(
    (v) => !v || /^[0-9+()\s-]{7,20}$/.test(v),
    'Usa solo números, espacios, +, ( ) y guiones (7 a 20 caracteres)',
  );

const permissions = {
  canAuthorize: z.boolean(),
  canDiscountUnlimited: z.boolean(),
};

const employeeData = {
  phone: phoneField,
  employeeNumber: z
    .string()
    .trim()
    .toUpperCase()
    .max(20, 'Máximo 20 caracteres'),
  hireDate: z.string(),
};

export const createUserSchema = z.object({
  name: nameField,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Escribe el correo')
    .pipe(z.email('El correo no es válido')),
  role,
  password: passwordField,
  ...employeeData,
  ...permissions,
});

export const editUserSchema = z.object({
  name: nameField,
  role,
  ...employeeData,
  ...permissions,
});

export const changePasswordSchema = z
  .object({ password: passwordField, confirm: z.string() })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    message: 'Las contraseñas no coinciden',
  });

export type CreateUserValues = z.infer<typeof createUserSchema>;
export type EditUserValues = z.infer<typeof editUserSchema>;
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
