import { z } from 'zod';
import { Currency, InventoryCategory, ItemCondition } from '../enums/index.js';

export const createInventoryItemSchema = z.object({
  name: z.string().min(2, 'El nombre del artículo es requerido'),
  category: z.nativeEnum(InventoryCategory).default(InventoryCategory.CLOTHING),
  condition: z.nativeEnum(ItemCondition).default(ItemCondition.UNKNOWN),
  rating: z.number().int().min(1).max(5).optional().nullable(),
  purchasePrice: z.number().nonnegative().optional().nullable(),
  estimatedValue: z.number().nonnegative().optional().nullable(),
  currency: z.nativeEnum(Currency).default(Currency.DOP),
  purchaseDate: z.string().optional().nullable(),
  usageTimeText: z.string().optional().nullable(),
  isConsumable: z.boolean().default(false),
  quantity: z.number().int().min(1).default(1),
  location: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  colorOrDetails: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type CreateInventoryItemInput = z.infer<typeof createInventoryItemSchema>;

export const updateInventoryItemSchema = createInventoryItemSchema.partial();
export type UpdateInventoryItemInput = z.infer<typeof updateInventoryItemSchema>;

export const inventoryFilterSchema = z.object({
  category: z.nativeEnum(InventoryCategory).optional(),
  condition: z.nativeEnum(ItemCondition).optional(),
  isConsumable: z.boolean().optional(),
  search: z.string().optional(),
});

export type InventoryFilterInput = z.infer<typeof inventoryFilterSchema>;

export interface InventorySummary {
  totalItems: number;
  totalEstimatedValue: number;
  totalPurchasePrice: number;
  byCondition: Record<string, number>;
  byCategory: Record<string, { count: number; totalValue: number }>;
  topRatedCount: number;
  consumablesCount: number;
  unknownConditionCount: number;
}
