import { z } from 'zod';
import { AccountType, Currency } from '../enums/index.js';

export const CreateAccountSchema = z.object({
  name: z.string().min(2, 'El nombre de la cuenta es requerido'),
  type: z.nativeEnum(AccountType),
  currency: z.nativeEnum(Currency).default(Currency.DOP),
  balance: z.string().or(z.number()).transform(v => String(v)),
  bankId: z.string().optional(),
  creditLimit: z.string().or(z.number()).optional().transform(v => v ? String(v) : undefined),
  statementDay: z.number().int().min(1).max(31).optional(),
  dueDay: z.number().int().min(1).max(31).optional(),
  interestRate: z.number().optional(),
  last4: z.string().length(4, 'Deben ser exactamente 4 dígitos').optional(),
  color: z.string().default('#16a34a')
});

export type CreateAccountInput = z.infer<typeof CreateAccountSchema>;
