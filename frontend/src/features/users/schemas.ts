import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 8;

const name = z
  .string()
  .trim()
  .min(1, 'Escribe el nombre')
  .max(120, 'El nombre no puede pasar de 120 caracteres');

const role = z.enum(['ADMIN', 'RECEPTION', 'HOUSEKEEPING'], {
  error: 'Selecciona un rol',
});

const password = z
  .string()
  .min(
    PASSWORD_MIN_LENGTH,
    `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`,
  )
  .max(128, 'La contraseña no puede pasar de 128 caracteres');

export const createUserSchema = z.object({
  name,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Escribe el correo')
    .pipe(z.email('El correo no es válido')),
  role,
  password,
});

export const editUserSchema = z.object({ name, role });

export const changePasswordSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    message: 'Las contraseñas no coinciden',
  });

export type CreateUserValues = z.infer<typeof createUserSchema>;
export type EditUserValues = z.infer<typeof editUserSchema>;
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
