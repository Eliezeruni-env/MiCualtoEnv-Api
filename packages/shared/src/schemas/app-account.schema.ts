import { z } from 'zod';

export const createAppCredentialSchema = z.object({
  appName: z.string().min(2, 'El nombre de la aplicación o servicio es requerido'),
  linkedEmail: z.string().email('Ingresa un correo electrónico válido'),
  usernameOrHandle: z.string().optional().nullable(),
  password: z.string().min(1, 'La contraseña es requerida'),
  websiteUrl: z.string().optional().nullable(),
  hasTwoFactor: z.boolean().default(false),
  category: z.string().default('GENERAL'),
  notes: z.string().optional().nullable(),
});

export type CreateAppCredentialInput = z.infer<typeof createAppCredentialSchema>;

export const updateAppCredentialSchema = createAppCredentialSchema.partial();
export type UpdateAppCredentialInput = z.infer<typeof updateAppCredentialSchema>;

export const appCredentialFilterSchema = z.object({
  linkedEmail: z.string().optional(),
  category: z.string().optional(),
  search: z.string().optional(),
});

export type AppCredentialFilterInput = z.infer<typeof appCredentialFilterSchema>;

export interface AppCredentialSummary {
  totalAccounts: number;
  emailsCount: number;
  with2FaCount: number;
  byEmail: Record<string, number>;
}
