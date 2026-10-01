import { z } from 'zod';
import { Currency, UniversityExpenseCategory } from '../enums/index.js';

export const createUniversityExpenseSchema = z.object({
  title: z.string().min(2, 'El concepto o descripción del gasto es requerido'),
  category: z.nativeEnum(UniversityExpenseCategory).default(UniversityExpenseCategory.TUITION_FEE),
  amount: z.number().positive('El monto debe ser mayor a 0'),
  currency: z.nativeEnum(Currency).default(Currency.DOP),
  expenseDate: z.string().default(() => new Date().toISOString()),
  termSemester: z.string().optional().nullable(),
  isWaste: z.boolean().default(false),
  subject: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
  accountId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type CreateUniversityExpenseInput = z.infer<typeof createUniversityExpenseSchema>;

export const updateUniversityExpenseSchema = createUniversityExpenseSchema.partial();
export type UpdateUniversityExpenseInput = z.infer<typeof updateUniversityExpenseSchema>;

export const universityExpenseFilterSchema = z.object({
  category: z.nativeEnum(UniversityExpenseCategory).optional(),
  isWaste: z.boolean().optional(),
  termSemester: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
});

export type UniversityExpenseFilterInput = z.infer<typeof universityExpenseFilterSchema>;

export interface UniversityCategorySummary {
  total: number;
  count: number;
  percentage: number;
}

export interface UniversitySummary {
  totalSpent: number;
  totalTuition: number;
  totalTransport: number;
  totalFood: number;
  totalMaterials: number;
  totalWaste: number;
  totalOther: number;
  wastePercentage: number;
  expenseCount: number;
  wasteCount: number;
  byCategory: Record<string, UniversityCategorySummary>;
}
