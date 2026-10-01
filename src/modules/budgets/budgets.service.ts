import { prisma } from '../../config/prisma.js';
import Decimal from 'decimal.js';

export class BudgetsService {
  static async getMonthlyBudget(userId: string, month: number, year: number) {
    // 1. Obtener o crear el presupuesto mensual
    let budget = await prisma.budget.findUnique({
      where: { userId_month_year: { userId, month, year } },
      include: {
        lines: {
          include: { category: true },
        },
      },
    });

    if (!budget) {
      budget = await prisma.budget.create({
        data: {
          userId,
          name: `Presupuesto ${month}/${year}`,
          month,
          year,
        },
        include: {
          lines: {
            include: { category: true },
          },
        },
      });
    }

    // 2. Calcular gastos reales del mes agrupados por categoría
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const expenses = await prisma.transaction.findMany({
      where: {
        userId,
        type: 'EXPENSE',
        deletedAt: null,
        occurredAt: { gte: startDate, lte: endDate },
        categoryId: { not: null },
      },
      select: {
        categoryId: true,
        amount: true,
      },
    });

    // Sumar gastos por categoría
    const spentByCategory: Record<string, Decimal> = {};
    for (const exp of expenses) {
      if (!exp.categoryId) continue;
      if (!spentByCategory[exp.categoryId]) {
        spentByCategory[exp.categoryId] = new Decimal(0);
      }
      spentByCategory[exp.categoryId] = spentByCategory[exp.categoryId].plus(exp.amount.toString());
    }

    // Actualizar líneas con el gasto real calculado
    const enrichedLines = budget.lines.map((line) => {
      const realSpent = spentByCategory[line.categoryId] || new Decimal(0);
      const budgeted = new Decimal(line.budgetedAmount.toString());
      const pct = budgeted.isZero() ? 0 : Math.round(realSpent.dividedBy(budgeted).times(100).toNumber());
      const remaining = budgeted.minus(realSpent);

      return {
        id: line.id,
        categoryId: line.categoryId,
        categoryName: line.category.name,
        categoryColor: line.category.color,
        categoryIcon: line.category.icon,
        budgetedAmount: budgeted.toNumber(),
        spentAmount: realSpent.toNumber(),
        remainingAmount: remaining.toNumber(),
        percentage: pct,
        isOverBudget: realSpent.greaterThan(budgeted),
        alertThreshold: line.alertThreshold,
      };
    });

    const totalBudgeted = enrichedLines.reduce((acc, l) => acc + l.budgetedAmount, 0);
    const totalSpent = enrichedLines.reduce((acc, l) => acc + l.spentAmount, 0);
    const totalRemaining = totalBudgeted - totalSpent;
    const totalPercentage = totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0;

    return {
      budget: {
        id: budget.id,
        name: budget.name,
        month: budget.month,
        year: budget.year,
        totalBudgeted,
        totalSpent,
        totalRemaining,
        totalPercentage,
        lines: enrichedLines,
      },
    };
  }

  static async upsertBudgetLine(
    userId: string,
    input: {
      month: number;
      year: number;
      categoryId: string;
      budgetedAmount: number;
      alertThreshold?: number;
    }
  ) {
    let budget = await prisma.budget.findUnique({
      where: { userId_month_year: { userId, month: input.month, year: input.year } },
    });

    if (!budget) {
      budget = await prisma.budget.create({
        data: {
          userId,
          name: `Presupuesto ${input.month}/${input.year}`,
          month: input.month,
          year: input.year,
        },
      });
    }

    return prisma.budgetLine.upsert({
      where: {
        budgetId_categoryId: {
          budgetId: budget.id,
          categoryId: input.categoryId,
        },
      },
      create: {
        budgetId: budget.id,
        categoryId: input.categoryId,
        budgetedAmount: new Decimal(input.budgetedAmount).toNumber(),
        alertThreshold: input.alertThreshold || 80,
      },
      update: {
        budgetedAmount: new Decimal(input.budgetedAmount).toNumber(),
        alertThreshold: input.alertThreshold || 80,
      },
      include: { category: true },
    });
  }

  static async listCategories(userId: string) {
    return prisma.category.findMany({
      where: {
        OR: [{ userId }, { isSystem: true }],
      },
      orderBy: { name: 'asc' },
    });
  }

  static async deleteLine(userId: string, lineId: string) {
    const line = await prisma.budgetLine.findFirst({
      where: { id: lineId, budget: { userId } }
    });
    if (!line) throw new Error('Línea de presupuesto no encontrada');
    await prisma.budgetLine.delete({ where: { id: lineId } });
    return { success: true };
  }

  static async deleteAll(userId: string) {
    await prisma.budgetLine.deleteMany({ where: { budget: { userId } } });
    await prisma.budget.deleteMany({ where: { userId } });
    return { success: true, message: 'Todos los presupuestos han sido eliminados' };
  }
}
