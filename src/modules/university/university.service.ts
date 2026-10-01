import { prisma } from '../../config/prisma.js';
import {
  CreateUniversityExpenseInput,
  UpdateUniversityExpenseInput,
  UniversityExpenseFilterInput,
  UniversitySummary,
  UniversityExpenseCategory,
  TransactionType,
  TransactionSource,
  Currency,
  TransactionStatus,
} from '@micualto/shared';
import { TransactionsService } from '../transactions/transactions.service.js';
import Decimal from 'decimal.js';

export class UniversityService {
  static async list(userId: string, filter?: UniversityExpenseFilterInput) {
    const where: any = { userId };

    if (filter?.category) {
      where.category = filter.category;
    }

    if (filter?.isWaste !== undefined) {
      where.isWaste = filter.isWaste;
    }

    if (filter?.termSemester) {
      where.termSemester = filter.termSemester;
    }

    if (filter?.startDate || filter?.endDate) {
      where.expenseDate = {};
      if (filter.startDate) {
        where.expenseDate.gte = new Date(filter.startDate);
      }
      if (filter.endDate) {
        const end = new Date(filter.endDate);
        end.setHours(23, 59, 59, 999);
        where.expenseDate.lte = end;
      }
    }

    if (filter?.search?.trim()) {
      const q = filter.search.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } },
        { subject: { contains: q, mode: 'insensitive' } },
        { location: { contains: q, mode: 'insensitive' } },
      ];
    }

    const expenses = await prisma.universityExpense.findMany({
      where,
      orderBy: { expenseDate: 'desc' },
    });

    return expenses.map((e) => ({
      ...e,
      amount: Number(e.amount),
    }));
  }

  static async getById(userId: string, id: string) {
    const expense = await prisma.universityExpense.findFirst({
      where: { id, userId },
    });

    if (!expense) {
      throw new Error('Gasto universitario no encontrado');
    }

    let accountName: string | null = null;
    if (expense.accountId) {
      const account = await prisma.account.findUnique({
        where: { id: expense.accountId },
        select: { name: true, type: true },
      });
      if (account) {
        accountName = account.name;
      }
    }

    return {
      ...expense,
      amount: Number(expense.amount),
      accountName,
    };
  }

  static async getSummary(
    userId: string,
    filter?: { termSemester?: string; startDate?: string; endDate?: string }
  ): Promise<UniversitySummary> {
    const where: any = { userId };

    if (filter?.termSemester) {
      where.termSemester = filter.termSemester;
    }

    if (filter?.startDate || filter?.endDate) {
      where.expenseDate = {};
      if (filter.startDate) {
        where.expenseDate.gte = new Date(filter.startDate);
      }
      if (filter.endDate) {
        const end = new Date(filter.endDate);
        end.setHours(23, 59, 59, 999);
        where.expenseDate.lte = end;
      }
    }

    const expenses = await prisma.universityExpense.findMany({
      where,
      select: {
        category: true,
        amount: true,
        isWaste: true,
      },
    });

    let totalSpent = 0;
    let totalTuition = 0;
    let totalTransport = 0;
    let totalFood = 0;
    let totalMaterials = 0;
    let totalWaste = 0;
    let totalOther = 0;
    let wasteCount = 0;

    const byCategory: Record<string, { total: number; count: number; percentage: number }> = {
      TUITION_FEE: { total: 0, count: 0, percentage: 0 },
      TRANSPORT: { total: 0, count: 0, percentage: 0 },
      FOOD_SNACKS: { total: 0, count: 0, percentage: 0 },
      MATERIALS_BOOKS: { total: 0, count: 0, percentage: 0 },
      WASTE_LEISURE: { total: 0, count: 0, percentage: 0 },
      OTHER: { total: 0, count: 0, percentage: 0 },
    };

    for (const exp of expenses) {
      const amt = Number(exp.amount) || 0;
      totalSpent += amt;

      if (exp.isWaste) {
        totalWaste += amt;
        wasteCount++;
      }

      if (!byCategory[exp.category]) {
        byCategory[exp.category] = { total: 0, count: 0, percentage: 0 };
      }
      byCategory[exp.category].total += amt;
      byCategory[exp.category].count += 1;

      switch (exp.category) {
        case 'TUITION_FEE':
          totalTuition += amt;
          break;
        case 'TRANSPORT':
          totalTransport += amt;
          break;
        case 'FOOD_SNACKS':
          totalFood += amt;
          break;
        case 'MATERIALS_BOOKS':
          totalMaterials += amt;
          break;
        case 'WASTE_LEISURE':
          // Si no estaba marcado con isWaste explícito, la categoría cuenta para el total de desperdicio también
          if (!exp.isWaste) {
            totalWaste += amt;
            wasteCount++;
          }
          break;
        case 'OTHER':
        default:
          totalOther += amt;
          break;
      }
    }

    // Calcular porcentajes por categoría
    for (const catKey of Object.keys(byCategory)) {
      byCategory[catKey].percentage =
        totalSpent > 0 ? Math.round((byCategory[catKey].total / totalSpent) * 100) : 0;
    }

    const wastePercentage = totalSpent > 0 ? Math.round((totalWaste / totalSpent) * 100) : 0;

    return {
      totalSpent,
      totalTuition,
      totalTransport,
      totalFood,
      totalMaterials,
      totalWaste,
      totalOther,
      wastePercentage,
      expenseCount: expenses.length,
      wasteCount,
      byCategory,
    };
  }

  static async getSemesters(userId: string): Promise<string[]> {
    const list = await prisma.universityExpense.findMany({
      where: {
        userId,
        termSemester: { not: null },
      },
      distinct: ['termSemester'],
      select: { termSemester: true },
      orderBy: { termSemester: 'desc' },
    });

    return list.map((l) => l.termSemester!).filter(Boolean);
  }

  static async create(userId: string, input: CreateUniversityExpenseInput) {
    let linkedTxId: string | undefined = undefined;

    // Si el usuario especificó una cuenta bancaria, podemos registrar el gasto contable en el ledger
    if (input.accountId) {
      try {
        let uniCat = await prisma.category.findFirst({
          where: {
            OR: [{ userId }, { isSystem: true }],
            name: { contains: 'Educación', mode: 'insensitive' },
          },
        });

        if (!uniCat) {
          uniCat = await prisma.category.findFirst({
            where: { isSystem: true },
          });
        }

        if (uniCat) {
          const tx = await TransactionsService.create(userId, {
            type: TransactionType.EXPENSE,
            amount: String(input.amount),
            currency: input.currency || Currency.DOP,
            fxRate: 1.0,
            accountId: input.accountId,
            categoryId: uniCat.id,
            notes: `[🎓 Universidad - ${input.category}] ${input.title}${input.isWaste ? ' (Malgasto)' : ''}`,
            occurredAt: input.expenseDate,
            status: TransactionStatus.CONFIRMED,
            source: TransactionSource.MANUAL,
          });
          linkedTxId = tx.id;
        }
      } catch (err) {
        console.warn('No se pudo enlazar transacción automática de cuenta:', err);
      }
    }

    const expense = await prisma.universityExpense.create({
      data: {
        userId,
        title: input.title,
        category: input.category,
        amount: new Decimal(input.amount),
        currency: input.currency || 'DOP',
        expenseDate: new Date(input.expenseDate),
        termSemester: input.termSemester || null,
        isWaste: Boolean(input.isWaste),
        subject: input.subject || null,
        location: input.location || null,
        paymentMethod: input.paymentMethod || null,
        accountId: input.accountId || null,
        transactionId: linkedTxId || null,
        notes: input.notes || null,
      },
    });

    return {
      ...expense,
      amount: Number(expense.amount),
    };
  }

  static async update(userId: string, id: string, input: UpdateUniversityExpenseInput) {
    const existing = await prisma.universityExpense.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new Error('Gasto universitario no encontrado o no pertenece al usuario');
    }

    const updateData: any = {};
    if (input.title !== undefined) updateData.title = input.title;
    if (input.category !== undefined) updateData.category = input.category;
    if (input.amount !== undefined) updateData.amount = new Decimal(input.amount);
    if (input.currency !== undefined) updateData.currency = input.currency;
    if (input.expenseDate !== undefined) updateData.expenseDate = new Date(input.expenseDate);
    if (input.termSemester !== undefined) updateData.termSemester = input.termSemester || null;
    if (input.isWaste !== undefined) updateData.isWaste = input.isWaste;
    if (input.subject !== undefined) updateData.subject = input.subject || null;
    if (input.location !== undefined) updateData.location = input.location || null;
    if (input.paymentMethod !== undefined) updateData.paymentMethod = input.paymentMethod || null;
    if (input.accountId !== undefined) updateData.accountId = input.accountId || null;
    if (input.notes !== undefined) updateData.notes = input.notes || null;

    const updated = await prisma.universityExpense.update({
      where: { id },
      data: updateData,
    });

    return {
      ...updated,
      amount: Number(updated.amount),
    };
  }

  static async delete(userId: string, id: string) {
    const existing = await prisma.universityExpense.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new Error('Gasto universitario no encontrado');
    }

    await prisma.universityExpense.delete({
      where: { id },
    });

    return { success: true };
  }

  static async deleteAll(userId: string) {
    await prisma.universityExpense.deleteMany({ where: { userId } });
    return { success: true, message: 'Todos los gastos universitarios han sido eliminados' };
  }
}
