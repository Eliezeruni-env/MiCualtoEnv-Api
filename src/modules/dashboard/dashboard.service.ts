import { prisma } from '../../config/prisma.js';
import Decimal from 'decimal.js';
import { AccountType, TransactionType } from '@micualto/shared';
import { startOfMonth, endOfMonth } from 'date-fns';

export class DashboardService {
  static async getSummary(userId: string) {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    // 1. Obtener todas las cuentas del usuario
    const accounts = await prisma.account.findMany({
      where: { userId, isArchived: false },
      include: { bank: true }
    });

    let totalAssets = new Decimal(0);     // Cuentas de banco, efectivo, inversiones
    let totalLiabilities = new Decimal(0);// Deuda en tarjetas de crédito

    for (const acc of accounts) {
      const bal = new Decimal(acc.balance.toString());
      if (acc.type === AccountType.CREDIT_CARD) {
        totalLiabilities = totalLiabilities.plus(bal);
      } else {
        totalAssets = totalAssets.plus(bal);
      }
    }

    const netWorth = totalAssets.minus(totalLiabilities);

    // 2. Metas de ahorro activas (Dinero Reservado)
    const goals = await prisma.goal.findMany({
      where: { userId, status: 'ACTIVE' }
    });

    let totalReservedInGoals = new Decimal(0);
    for (const g of goals) {
      totalReservedInGoals = totalReservedInGoals.plus(new Decimal(g.currentAmount.toString()));
    }

    const realAvailable = Decimal.max(0, totalAssets.minus(totalReservedInGoals));

    // 3. Transacciones del mes actual (Gastos e Ingresos)
    const monthTransactions = await prisma.transaction.findMany({
      where: {
        userId,
        deletedAt: null,
        status: 'CONFIRMED',
        occurredAt: {
          gte: monthStart,
          lte: monthEnd
        }
      },
      include: {
        category: true,
        account: true
      }
    });

    let monthExpenses = new Decimal(0);
    let monthIncome = new Decimal(0);
    const categoryExpensesMap: Record<string, { name: string; color: string; icon: string; amount: Decimal }> = {};

    for (const tx of monthTransactions) {
      const amt = new Decimal(tx.amount.toString());
      if (tx.type === TransactionType.EXPENSE) {
        monthExpenses = monthExpenses.plus(amt);

        const catName = tx.category?.name || 'Varios';
        const catColor = tx.category?.color || '#16a34a';
        const catIcon = tx.category?.icon || 'tag';

        if (!categoryExpensesMap[catName]) {
          categoryExpensesMap[catName] = { name: catName, color: catColor, icon: catIcon, amount: new Decimal(0) };
        }
        categoryExpensesMap[catName].amount = categoryExpensesMap[catName].amount.plus(amt);
      } else if (tx.type === TransactionType.INCOME) {
        monthIncome = monthIncome.plus(amt);
      }
    }

    // Calcular porcentajes por categoría para los Donut Cards
    const spendingsCards = Object.values(categoryExpensesMap)
      .sort((a, b) => b.amount.minus(a.amount).toNumber())
      .slice(0, 4)
      .map(cat => ({
        name: cat.name,
        color: cat.color,
        amount: cat.amount.toNumber(),
        percentage: monthExpenses.gt(0) 
          ? Math.round(cat.amount.dividedBy(monthExpenses).times(100).toNumber()) 
          : 0
      }));

    // 4. Módulo de transporte stats rápidas
    const transportLogs = await prisma.transportLog.findMany({
      where: {
        userId,
        tripDate: { gte: monthStart, lte: monthEnd }
      },
      include: { transaction: true }
    });

    let monthTransportSpent = new Decimal(0);
    for (const t of transportLogs) {
      monthTransportSpent = monthTransportSpent.plus(new Decimal(t.transaction.amount.toString()));
    }

    // 5. Últimas 8 transacciones
    const recentTransactions = await prisma.transaction.findMany({
      where: { userId, deletedAt: null },
      include: {
        account: { include: { bank: true } },
        toAccount: { include: { bank: true } },
        category: true
      },
      orderBy: { occurredAt: 'desc' },
      take: 8
    });

    return {
      kpis: {
        netWorth: netWorth.toNumber(),
        realAvailable: realAvailable.toNumber(),
        reservedInGoals: totalReservedInGoals.toNumber(),
        monthExpenses: monthExpenses.toNumber(),
        monthIncome: monthIncome.toNumber(),
        totalAssets: totalAssets.toNumber(),
        totalLiabilities: totalLiabilities.toNumber(),
        transportSpent: monthTransportSpent.toNumber(),
        transportTrips: transportLogs.length
      },
      spendingsCards,
      accounts: accounts.map(a => ({
        id: a.id,
        name: a.name,
        type: a.type,
        currency: a.currency,
        balance: a.balance.toNumber(),
        creditLimit: a.creditLimit ? a.creditLimit.toNumber() : null,
        bankName: a.bank?.name,
        bankColor: a.bank?.color || a.color,
        last4: a.last4
      })),
      recentTransactions: recentTransactions.map(tx => ({
        id: tx.id,
        type: tx.type,
        amount: tx.amount.toNumber(),
        currency: tx.currency,
        accountName: tx.account.name,
        bankName: tx.account.bank?.name,
        toAccountName: tx.toAccount?.name,
        categoryName: tx.category?.name || 'General',
        categoryColor: tx.category?.color || '#16a34a',
        categoryIcon: tx.category?.icon || 'tag',
        notes: tx.notes,
        occurredAt: tx.occurredAt
      }))
    };
  }
}
