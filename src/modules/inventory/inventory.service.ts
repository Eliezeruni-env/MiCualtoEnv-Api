import { prisma } from '../../config/prisma.js';
import {
  CreateInventoryItemInput,
  UpdateInventoryItemInput,
  InventoryFilterInput,
  InventorySummary,
} from '@micualto/shared';
import Decimal from 'decimal.js';

export class InventoryService {
  static async list(userId: string, filter?: InventoryFilterInput) {
    const where: any = { userId };

    if (filter?.category) {
      where.category = filter.category;
    }

    if (filter?.condition) {
      where.condition = filter.condition;
    }

    if (filter?.isConsumable !== undefined) {
      where.isConsumable = filter.isConsumable;
    }

    if (filter?.search?.trim()) {
      const q = filter.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { brand: { contains: q, mode: 'insensitive' } },
        { location: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } },
        { colorOrDetails: { contains: q, mode: 'insensitive' } },
      ];
    }

    const items = await prisma.personalInventoryItem.findMany({
      where,
      orderBy: [{ rating: 'desc' }, { createdAt: 'desc' }],
    });

    return items.map((i) => ({
      ...i,
      purchasePrice: i.purchasePrice ? Number(i.purchasePrice) : null,
      estimatedValue: i.estimatedValue ? Number(i.estimatedValue) : null,
    }));
  }

  static async getById(userId: string, id: string) {
    const item = await prisma.personalInventoryItem.findFirst({
      where: { id, userId },
    });

    if (!item) {
      throw new Error('Artículo de inventario no encontrado');
    }

    return {
      ...item,
      purchasePrice: item.purchasePrice ? Number(item.purchasePrice) : null,
      estimatedValue: item.estimatedValue ? Number(item.estimatedValue) : null,
    };
  }

  static async getSummary(userId: string): Promise<InventorySummary> {
    const items = await prisma.personalInventoryItem.findMany({
      where: { userId },
      select: {
        category: true,
        condition: true,
        rating: true,
        purchasePrice: true,
        estimatedValue: true,
        isConsumable: true,
        quantity: true,
      },
    });

    let totalItems = 0;
    let totalEstimatedValue = 0;
    let totalPurchasePrice = 0;
    let topRatedCount = 0;
    let consumablesCount = 0;
    let unknownConditionCount = 0;

    const byCondition: Record<string, number> = {
      BRAND_NEW: 0,
      EXCELLENT: 0,
      GOOD: 0,
      FAIR: 0,
      DAMAGED: 0,
      UNKNOWN: 0,
    };

    const byCategory: Record<string, { count: number; totalValue: number }> = {};

    for (const item of items) {
      const qty = item.quantity || 1;
      totalItems += qty;

      const pPrice = (item.purchasePrice ? Number(item.purchasePrice) : 0) * qty;
      const eVal = (item.estimatedValue ? Number(item.estimatedValue) : 0) * qty;

      totalPurchasePrice += pPrice;
      totalEstimatedValue += eVal || pPrice; // Si no hay estimado, fallback al de compra

      if (item.condition) {
        byCondition[item.condition] = (byCondition[item.condition] || 0) + qty;
        if (item.condition === 'UNKNOWN') {
          unknownConditionCount += qty;
        }
      }

      if (item.rating && item.rating >= 5) {
        topRatedCount += qty;
      }

      if (item.isConsumable) {
        consumablesCount += qty;
      }

      if (!byCategory[item.category]) {
        byCategory[item.category] = { count: 0, totalValue: 0 };
      }
      byCategory[item.category].count += qty;
      byCategory[item.category].totalValue += eVal || pPrice;
    }

    return {
      totalItems,
      totalEstimatedValue,
      totalPurchasePrice,
      byCondition,
      byCategory,
      topRatedCount,
      consumablesCount,
      unknownConditionCount,
    };
  }

  static async create(userId: string, input: CreateInventoryItemInput) {
    const item = await prisma.personalInventoryItem.create({
      data: {
        userId,
        name: input.name,
        category: input.category,
        condition: input.condition || 'UNKNOWN',
        rating: input.rating ?? null,
        purchasePrice: input.purchasePrice !== undefined && input.purchasePrice !== null ? new Decimal(input.purchasePrice) : null,
        estimatedValue: input.estimatedValue !== undefined && input.estimatedValue !== null ? new Decimal(input.estimatedValue) : null,
        currency: input.currency || 'DOP',
        purchaseDate: input.purchaseDate ? new Date(input.purchaseDate) : null,
        usageTimeText: input.usageTimeText || null,
        isConsumable: Boolean(input.isConsumable),
        quantity: input.quantity || 1,
        location: input.location || null,
        brand: input.brand || null,
        colorOrDetails: input.colorOrDetails || null,
        notes: input.notes || null,
      },
    });

    return {
      ...item,
      purchasePrice: item.purchasePrice ? Number(item.purchasePrice) : null,
      estimatedValue: item.estimatedValue ? Number(item.estimatedValue) : null,
    };
  }

  static async update(userId: string, id: string, input: UpdateInventoryItemInput) {
    const existing = await prisma.personalInventoryItem.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new Error('Artículo de inventario no encontrado');
    }

    const data: any = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.category !== undefined) data.category = input.category;
    if (input.condition !== undefined) data.condition = input.condition;
    if (input.rating !== undefined) data.rating = input.rating;
    if (input.purchasePrice !== undefined) {
      data.purchasePrice = input.purchasePrice !== null ? new Decimal(input.purchasePrice) : null;
    }
    if (input.estimatedValue !== undefined) {
      data.estimatedValue = input.estimatedValue !== null ? new Decimal(input.estimatedValue) : null;
    }
    if (input.currency !== undefined) data.currency = input.currency;
    if (input.purchaseDate !== undefined) {
      data.purchaseDate = input.purchaseDate ? new Date(input.purchaseDate) : null;
    }
    if (input.usageTimeText !== undefined) data.usageTimeText = input.usageTimeText;
    if (input.isConsumable !== undefined) data.isConsumable = input.isConsumable;
    if (input.quantity !== undefined) data.quantity = input.quantity;
    if (input.location !== undefined) data.location = input.location;
    if (input.brand !== undefined) data.brand = input.brand;
    if (input.colorOrDetails !== undefined) data.colorOrDetails = input.colorOrDetails;
    if (input.notes !== undefined) data.notes = input.notes;

    const updated = await prisma.personalInventoryItem.update({
      where: { id },
      data,
    });

    return {
      ...updated,
      purchasePrice: updated.purchasePrice ? Number(updated.purchasePrice) : null,
      estimatedValue: updated.estimatedValue ? Number(updated.estimatedValue) : null,
    };
  }

  static async delete(userId: string, id: string) {
    const existing = await prisma.personalInventoryItem.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new Error('Artículo de inventario no encontrado');
    }

    await prisma.personalInventoryItem.delete({
      where: { id },
    });

    return { success: true };
  }

  static async deleteAll(userId: string) {
    await prisma.personalInventoryItem.deleteMany({ where: { userId } });
    return { success: true, message: 'Todos los artículos de inventario han sido eliminados' };
  }
}
