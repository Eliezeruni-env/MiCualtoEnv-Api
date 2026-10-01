import { z } from 'zod';
import { TransactionType, Currency, TransactionStatus, TransactionSource } from '../enums/index.js';

export const CreateTransactionSchema = z.object({
  type: z.nativeEnum(TransactionType),
  amount: z.string().or(z.number()).transform(v => String(v)),
  currency: z.nativeEnum(Currency).optional().default(Currency.DOP),
  fxRate: z.number().optional().default(1.0),
  accountId: z.string().uuid('ID de cuenta inválido'),
  toAccountId: z.string().uuid('ID de cuenta destino inválido').optional(),
  categoryId: z.string().uuid('ID de categoría inválido').optional(),
  merchantId: z.string().uuid().optional(),
  notes: z.string().optional(),
  occurredAt: z.string().or(z.date()).optional().default(() => new Date().toISOString()),
  status: z.nativeEnum(TransactionStatus).optional().default(TransactionStatus.CONFIRMED),
  source: z.nativeEnum(TransactionSource).optional().default(TransactionSource.MANUAL),
});

export type CreateTransactionInput = z.infer<typeof CreateTransactionSchema>;
