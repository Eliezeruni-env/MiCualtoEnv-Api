import { z } from 'zod';
import { Currency, LoanType } from '../enums/index.js';

export const createDebtSchema = z.object({
  creditorName: z.string().min(2, 'El nombre del acreedor o entidad es requerido'),
  totalAmount: z.number().positive('El monto total debe ser mayor a 0'),
  remainingAmount: z.number().nonnegative('El saldo pendiente no puede ser negativo').optional(),
  currency: z.nativeEnum(Currency).default(Currency.DOP),
  interestRate: z.number().nonnegative('La tasa no puede ser negativa').optional(),
  totalInstallments: z.number().int().positive('Número de cuotas debe ser mayor a 0').optional(),
  paidInstallments: z.number().int().nonnegative('Cuotas pagadas no puede ser negativo').default(0),
  dueDate: z.string().optional().nullable(),
  notes: z.string().optional(),
});

export type CreateDebtInput = z.infer<typeof createDebtSchema>;

export const recordDebtPaymentSchema = z.object({
  amount: z.number().positive('El monto del abono debe ser mayor a 0'),
  accountId: z.string().uuid('ID de cuenta bancaria inválido').optional().nullable(),
  principalPart: z.number().nonnegative().optional(),
  interestPart: z.number().nonnegative().optional(),
  paymentDate: z.string().optional().nullable(),
  notes: z.string().optional(),
});

export type RecordDebtPaymentInput = z.infer<typeof recordDebtPaymentSchema>;

export const createLoanSchema = z.object({
  personName: z.string().optional(),
  borrowerName: z.string().optional(),
  personPhone: z.string().optional(),
  amount: z.number().positive('El monto prestado debe ser mayor a 0'),
  currency: z.nativeEnum(Currency).default(Currency.DOP),
  expectedDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  concept: z.string().optional(),
  notes: z.string().optional(),
  accountId: z.string().uuid('ID de cuenta bancaria inválido').optional().nullable(),
  interestRate: z.number().optional(),
});

export type CreateLoanInput = z.infer<typeof createLoanSchema>;

export const recordLoanCollectionSchema = z.object({
  amount: z.number().positive('El monto cobrado debe ser mayor a 0'),
  accountId: z.string().uuid('ID de cuenta bancaria inválido').optional().nullable(),
  collectionDate: z.string().optional().nullable(),
  notes: z.string().optional(),
});

export type RecordLoanCollectionInput = z.infer<typeof recordLoanCollectionSchema>;
