import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/AppError.js';
import Decimal from 'decimal.js';

export class GoalsService {
  static async list(userId: string) {
    const goals = await prisma.goal.findMany({
      where: { userId },
      include: {
        linkedAccount: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return goals.map((g) => {
      const target = new Decimal(g.targetAmount.toString());
      const current = new Decimal(g.currentAmount.toString());
      const remaining = target.minus(current);
      const percentage = target.isZero() ? 0 : Math.min(100, Math.round(current.dividedBy(target).times(100).toNumber()));

      let daysLeft: number | null = null;
      if (g.targetDate) {
        const diffMs = new Date(g.targetDate).getTime() - Date.now();
        daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      }

      return {
        id: g.id,
        name: g.name,
        description: g.description,
        kind: g.kind,
        mode: g.mode,
        currency: g.currency,
        targetAmount: target.toNumber(),
        currentAmount: current.toNumber(),
        remainingAmount: remaining.greaterThan(0) ? remaining.toNumber() : 0,
        percentage,
        targetDate: g.targetDate,
        daysLeft,
        icon: g.icon,
        color: g.color,
        status: g.status,
        linkedAccount: g.linkedAccount ? { id: g.linkedAccount.id, name: g.linkedAccount.name } : null,
        createdAt: g.createdAt,
      };
    });
  }

  static async create(
    userId: string,
    input: {
      name: string;
      description?: string;
      kind?: any;
      mode?: any;
      targetAmount: number;
      initialAmount?: number;
      targetDate?: string;
      linkedAccountId?: string;
      color?: string;
      icon?: string;
    }
  ) {
    return prisma.goal.create({
      data: {
        userId,
        name: input.name,
        description: input.description,
        kind: input.kind || 'SAVINGS',
        mode: input.mode || 'VIRTUAL_ENVELOPE',
        targetAmount: new Decimal(input.targetAmount).toNumber(),
        currentAmount: input.initialAmount ? new Decimal(input.initialAmount).toNumber() : 0,
        targetDate: input.targetDate ? new Date(input.targetDate) : undefined,
        linkedAccountId: input.linkedAccountId || undefined,
        color: input.color || '#2563eb',
        icon: input.icon || 'target',
      },
    });
  }

  static async contribute(
    userId: string,
    goalId: string,
    input: {
      amount: number;
      fromAccountId: string;
      notes?: string;
    }
  ) {
    const goal = await prisma.goal.findFirst({
      where: { id: goalId, userId },
    });
    if (!goal) throw AppError.notFound('Meta no encontrada');

    const account = await prisma.account.findFirst({
      where: { id: input.fromAccountId, userId },
    });
    if (!account) throw AppError.notFound('Cuenta de origen no encontrada');

    const amountDec = new Decimal(input.amount);
    if (amountDec.lessThanOrEqualTo(0)) {
      throw AppError.badRequest('El monto debe ser mayor a 0');
    }

    return prisma.$transaction(async (tx) => {
      // 1. Descontar de cuenta de banco
      await tx.account.update({
        where: { id: account.id },
        data: {
          balance: new Decimal(account.balance.toString()).minus(amountDec).toNumber(),
        },
      });

      // 2. Incrementar saldo actual en meta
      const newCurrentAmount = new Decimal(goal.currentAmount.toString()).plus(amountDec);
      const isCompleted = newCurrentAmount.greaterThanOrEqualTo(new Decimal(goal.targetAmount.toString()));

      const updatedGoal = await tx.goal.update({
        where: { id: goalId },
        data: {
          currentAmount: newCurrentAmount.toNumber(),
          status: isCompleted ? 'COMPLETED' : goal.status,
        },
      });

      // 3. Registrar transacción de contribución
      await tx.transaction.create({
        data: {
          userId,
          type: 'GOAL_CONTRIBUTION',
          amount: amountDec.toNumber(),
          currency: goal.currency,
          accountId: account.id,
          goalId: goal.id,
          notes: input.notes || `Aporte a meta: ${goal.name}`,
          status: 'CONFIRMED',
          source: 'MANUAL',
        },
      });

      return updatedGoal;
    });
  }

  static async delete(userId: string, goalId: string) {
    const goal = await prisma.goal.findFirst({
      where: { id: goalId, userId },
    });
    if (!goal) throw AppError.notFound('Meta no encontrada');

    return prisma.goal.delete({
      where: { id: goalId },
    });
  }

  static async deleteAll(userId: string) {
    await prisma.goal.deleteMany({ where: { userId } });
    return { success: true, message: 'Todas las metas han sido eliminadas' };
  }
}
