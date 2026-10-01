import { z } from 'zod';
import { Currency, QuincenaStatus, AllocationCategory } from '../enums/index.js';

export const createQuincenaPlanSchema = z.object({
  name: z.string().min(2, 'El nombre de la quincena es requerido'),
  periodNumber: z.number().int().min(1).max(2),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
  startDate: z.string(),
  endDate: z.string(),
  payDate: z.string(),
  expectedIncome: z.number().nonnegative('El ingreso estimado no puede ser negativo'),
  actualIncome: z.number().nonnegative().optional().nullable(),
  currency: z.nativeEnum(Currency).default(Currency.DOP),
  status: z.nativeEnum(QuincenaStatus).default(QuincenaStatus.PLANNED),
  notes: z.string().optional().nullable(),
});

export type CreateQuincenaPlanInput = z.infer<typeof createQuincenaPlanSchema>;

export const updateQuincenaPlanSchema = createQuincenaPlanSchema.partial();
export type UpdateQuincenaPlanInput = z.infer<typeof updateQuincenaPlanSchema>;

export const createAllocationSchema = z.object({
  name: z.string().min(2, 'El nombre del gasto o asignación es requerido'),
  category: z.nativeEnum(AllocationCategory).default(AllocationCategory.FIXED_EXPENSE),
  expectedAmount: z.number().positive('El monto asignado debe ser mayor a 0'),
  actualAmount: z.number().nonnegative().optional().nullable(),
  isPaid: z.boolean().default(false),
  dueDate: z.string().optional().nullable(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).default('HIGH'),
  notes: z.string().optional().nullable(),
  linkedDebtId: z.string().optional().nullable(),
  linkedSubscriptionId: z.string().optional().nullable(),
  linkedGoalId: z.string().optional().nullable(),
});

export type CreateAllocationInput = z.infer<typeof createAllocationSchema>;

export const updateAllocationSchema = createAllocationSchema.partial();
export type UpdateAllocationInput = z.infer<typeof updateAllocationSchema>;

export const generateMonthQuincenasSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  defaultIncome: z.number().positive('El ingreso proyectado por quincena debe ser mayor a 0'),
  currency: z.nativeEnum(Currency).default(Currency.DOP),
});

export type GenerateMonthQuincenasInput = z.infer<typeof generateMonthQuincenasSchema>;

export interface QuincenaSummary {
  totalIncome: number;
  totalPlannedExpenses: number;
  totalPaid: number;
  totalPending: number;
  freeMoney: number;
  freePercentage: number;
  isOvercommitted: boolean;
  expenseCount: number;
  paidCount: number;
}

export function calculateQuincenaSummary(plan: {
  expectedIncome: number | string;
  actualIncome?: number | string | null;
  allocations?: Array<{
    expectedAmount: number | string;
    actualAmount?: number | string | null;
    isPaid: boolean;
  }>;
}): QuincenaSummary {
  const actualInc = plan.actualIncome ? Number(plan.actualIncome) : 0;
  const expectedInc = Number(plan.expectedIncome) || 0;
  const totalIncome = actualInc > 0 ? actualInc : expectedInc;

  const allocations = plan.allocations || [];
  let totalPlannedExpenses = 0;
  let totalPaid = 0;
  let paidCount = 0;

  for (const item of allocations) {
    const planned = Number(item.expectedAmount) || 0;
    const actual = item.actualAmount !== null && item.actualAmount !== undefined ? Number(item.actualAmount) : planned;
    totalPlannedExpenses += planned;

    if (item.isPaid) {
      totalPaid += actual;
      paidCount++;
    }
  }

  const totalPending = Math.max(0, totalPlannedExpenses - totalPaid);
  const effectiveSpentOrCommitted = totalPaid + totalPending;
  const freeMoney = totalIncome - effectiveSpentOrCommitted;
  const freePercentage = totalIncome > 0 ? Math.round((freeMoney / totalIncome) * 100) : 0;
  const isOvercommitted = freeMoney < 0;

  return {
    totalIncome,
    totalPlannedExpenses,
    totalPaid,
    totalPending,
    freeMoney,
    freePercentage,
    isOvercommitted,
    expenseCount: allocations.length,
    paidCount,
  };
}
