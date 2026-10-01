import { prisma } from '../../config/prisma.js';
import {
  CreateSubscriptionInput,
  UpdateSubscriptionInput,
  SubscriptionFilterInput,
  SubscriptionSummary,
  Currency,
} from '@micualto/shared';
import Decimal from 'decimal.js';

const DEFAULT_USD_TO_DOP = 60.25;

export class SubscriptionsService {
  static async list(userId: string, filter?: SubscriptionFilterInput) {
    const where: any = { userId };

    if (filter?.isActive !== undefined) {
      where.isActive = filter.isActive;
    }

    if (filter?.currency) {
      where.currency = filter.currency;
    }

    if (filter?.search?.trim()) {
      const q = filter.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { tier: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } },
      ];
    }

    const list = await prisma.subscription.findMany({
      where,
      include: {
        account: { select: { id: true, name: true, type: true } },
        category: { select: { id: true, name: true, color: true, icon: true } },
      },
      orderBy: [{ isActive: 'desc' }, { nextRenewalDate: 'asc' }],
    });

    return list.map((s) => ({
      ...s,
      amount: Number(s.amount),
    }));
  }

  static async getById(userId: string, id: string) {
    const sub = await prisma.subscription.findFirst({
      where: { id, userId },
      include: {
        account: { select: { id: true, name: true, type: true } },
        category: { select: { id: true, name: true, color: true, icon: true } },
      },
    });

    if (!sub) {
      throw new Error('Suscripción no encontrada');
    }

    return {
      ...sub,
      amount: Number(sub.amount),
    };
  }

  static async getSummary(userId: string): Promise<SubscriptionSummary> {
    const subs = await prisma.subscription.findMany({
      where: { userId },
    });

    let totalMonthlyDop = 0;
    let totalMonthlyUsd = 0;
    let activeCount = 0;
    let pausedCount = 0;

    let nearestSub: { name: string; date: string; amount: number; currency: string; daysRemaining: number } | null = null;
    let minDays = Infinity;
    const now = new Date();

    for (const sub of subs) {
      const amt = Number(sub.amount) || 0;
      const cycle = (sub.billingCycle || 'MONTHLY').toUpperCase();

      let monthlyNorm = amt;
      if (cycle === 'ANNUAL') {
        monthlyNorm = amt / 12;
      } else if (cycle === 'WEEKLY') {
        monthlyNorm = amt * 4.33;
      } else if (cycle === 'QUARTERLY') {
        monthlyNorm = amt / 3;
      }

      if (sub.isActive) {
        activeCount++;
        if (sub.currency === 'USD') {
          totalMonthlyUsd += monthlyNorm;
          totalMonthlyDop += monthlyNorm * DEFAULT_USD_TO_DOP;
        } else {
          totalMonthlyDop += monthlyNorm;
          totalMonthlyUsd += monthlyNorm / DEFAULT_USD_TO_DOP;
        }

        // Check nearest renewal date
        const renewal = new Date(sub.nextRenewalDate);
        const diffMs = renewal.getTime() - now.getTime();
        const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        if (days >= 0 && days < minDays) {
          minDays = days;
          nearestSub = {
            name: sub.name,
            date: sub.nextRenewalDate.toISOString(),
            amount: amt,
            currency: sub.currency,
            daysRemaining: days,
          };
        }
      } else {
        pausedCount++;
      }
    }

    return {
      totalMonthlyDop: Math.round(totalMonthlyDop * 100) / 100,
      totalMonthlyUsd: Math.round(totalMonthlyUsd * 100) / 100,
      totalAnnualDop: Math.round(totalMonthlyDop * 12 * 100) / 100,
      totalAnnualUsd: Math.round(totalMonthlyUsd * 12 * 100) / 100,
      activeCount,
      pausedCount,
      nextRenewal: nearestSub,
    };
  }

  static async create(userId: string, input: CreateSubscriptionInput) {
    const sub = await prisma.subscription.create({
      data: {
        userId,
        name: input.name,
        amount: new Decimal(input.amount),
        currency: input.currency || Currency.USD,
        billingCycle: input.billingCycle || 'MONTHLY',
        nextRenewalDate: new Date(input.nextRenewalDate),
        isActive: input.isActive ?? true,
        tier: input.tier || null,
        accountId: input.accountId || null,
        categoryId: input.categoryId || null,
        websiteUrl: input.websiteUrl || null,
        notes: input.notes || null,
      },
      include: {
        account: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
    });

    return {
      ...sub,
      amount: Number(sub.amount),
    };
  }

  static async update(userId: string, id: string, input: UpdateSubscriptionInput) {
    const existing = await prisma.subscription.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new Error('Suscripción no encontrada');
    }

    const data: any = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.amount !== undefined) data.amount = new Decimal(input.amount);
    if (input.currency !== undefined) data.currency = input.currency;
    if (input.billingCycle !== undefined) data.billingCycle = input.billingCycle;
    if (input.nextRenewalDate !== undefined) data.nextRenewalDate = new Date(input.nextRenewalDate);
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.tier !== undefined) data.tier = input.tier;
    if (input.accountId !== undefined) data.accountId = input.accountId || null;
    if (input.categoryId !== undefined) data.categoryId = input.categoryId || null;
    if (input.websiteUrl !== undefined) data.websiteUrl = input.websiteUrl;
    if (input.notes !== undefined) data.notes = input.notes;

    const updated = await prisma.subscription.update({
      where: { id },
      data,
      include: {
        account: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
    });

    return {
      ...updated,
      amount: Number(updated.amount),
    };
  }

  static async toggleActive(userId: string, id: string) {
    const existing = await prisma.subscription.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new Error('Suscripción no encontrada');
    }

    const updated = await prisma.subscription.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });

    return {
      ...updated,
      amount: Number(updated.amount),
    };
  }

  static async delete(userId: string, id: string) {
    const existing = await prisma.subscription.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new Error('Suscripción no encontrada');
    }

    await prisma.subscription.delete({
      where: { id },
    });

    return { success: true };
  }

  static async deleteAll(userId: string) {
    const result = await prisma.subscription.deleteMany({
      where: { userId },
    });

    return { success: true, count: result.count };
  }

  static async bulkDelete(userId: string, ids: string[]) {
    if (!ids || ids.length === 0) {
      return { success: true, count: 0 };
    }

    const result = await prisma.subscription.deleteMany({
      where: {
        userId,
        id: { in: ids },
      },
    });

    return { success: true, count: result.count };
  }
}

