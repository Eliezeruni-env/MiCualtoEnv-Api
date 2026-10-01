import { z } from 'zod';
import { Currency } from '../enums/index.js';

export const createSubscriptionSchema = z.object({
  name: z.string().min(2, 'El nombre de la suscripción es requerido'),
  amount: z.number().positive('El monto debe ser mayor a 0'),
  currency: z.nativeEnum(Currency).default(Currency.USD),
  billingCycle: z.enum(['MONTHLY', 'ANNUAL', 'WEEKLY', 'QUARTERLY']).default('MONTHLY'),
  nextRenewalDate: z.string(),
  isActive: z.boolean().default(true),
  tier: z.string().optional().nullable(),
  accountId: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  websiteUrl: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;

export const updateSubscriptionSchema = createSubscriptionSchema.partial();
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;

export const subscriptionFilterSchema = z.object({
  isActive: z.boolean().optional(),
  currency: z.nativeEnum(Currency).optional(),
  search: z.string().optional(),
});

export type SubscriptionFilterInput = z.infer<typeof subscriptionFilterSchema>;

export interface SubscriptionSummary {
  totalMonthlyDop: number;
  totalMonthlyUsd: number;
  totalAnnualDop: number;
  totalAnnualUsd: number;
  activeCount: number;
  pausedCount: number;
  nextRenewal: {
    name: string;
    date: string;
    amount: number;
    currency: string;
    daysRemaining: number;
  } | null;
}
