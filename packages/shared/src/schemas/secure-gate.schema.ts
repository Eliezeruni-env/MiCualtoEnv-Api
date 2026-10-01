import { z } from 'zod';
import { SecureScope } from '../enums/index.js';

export const SecureUnlockSchema = z.object({
  scope: z.nativeEnum(SecureScope),
  username: z
    .string()
    .min(3, 'El nombre de usuario debe tener al menos 3 caracteres')
    .max(30, 'Máximo 30 caracteres')
    .regex(/^[a-z0-9._-]+$/, 'Solo se permiten letras minúsculas, números, puntos, guiones y guiones bajos'),
  email: z.string().email('Introduce un correo electrónico válido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  totp: z.string().length(6, 'El código 2FA debe tener 6 dígitos').optional(),
});

export type SecureUnlockInput = z.infer<typeof SecureUnlockSchema>;

export const UpdateUsernameSchema = z.object({
  username: z
    .string()
    .min(3, 'El nombre de usuario debe tener al menos 3 caracteres')
    .max(30, 'Máximo 30 caracteres')
    .regex(/^[a-z0-9._-]+$/, 'Solo se permiten letras minúsculas, números, puntos, guiones y guiones bajos'),
  currentPassword: z.string().min(1, 'Debes confirmar tu contraseña actual'),
});

export type UpdateUsernameInput = z.infer<typeof UpdateUsernameSchema>;
