import { prisma } from '../../config/prisma.js';
import { CreateTransactionInput, TransactionType } from '@micualto/shared';
import { LedgerService } from '../ledger/ledger.service.js';
import { AppError } from '../../utils/AppError.js';
import Decimal from 'decimal.js';

export class TransactionsService {
  static async list(userId: string, filters?: { limit?: number; accountId?: string; type?: TransactionType }) {
    return prisma.transaction.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(filters?.accountId
          ? {
              OR: [
                { accountId: filters.accountId },
                { toAccountId: filters.accountId }
              ]
            }
          : {}),
        ...(filters?.type ? { type: filters.type } : {})
      },
      include: {
        account: { include: { bank: true } },
        toAccount: { include: { bank: true } },
        category: true,
        transportLog: true
      },
      orderBy: { occurredAt: 'desc' },
      take: filters?.limit || 50
    });
  }

  static async create(userId: string, input: CreateTransactionInput) {
    const amountDecimal = new Decimal(input.amount);

    return prisma.$transaction(async (tx) => {
      // 1. Crear transacción
      const transaction = await tx.transaction.create({
        data: {
          userId,
          type: input.type,
          amount: amountDecimal.toNumber(),
          currency: input.currency,
          fxRate: input.fxRate,
          accountId: input.accountId,
          toAccountId: input.toAccountId,
          categoryId: input.categoryId,
          merchantId: input.merchantId,
          notes: input.notes,
          occurredAt: new Date(input.occurredAt),
          status: input.status,
          source: input.source
        },
        include: {
          account: true,
          toAccount: true,
          category: true
        }
      });

      // 2. Aplicar impacto contable atómico en Ledger
      await LedgerService.applyTransaction(tx, {
        userId,
        type: input.type,
        amount: amountDecimal,
        accountId: input.accountId,
        toAccountId: input.toAccountId
      });

      // 3. Crear log de auditoría
      await tx.auditLog.create({
        data: {
          userId,
          entityType: 'Transaction',
          entityId: transaction.id,
          action: 'CREATE',
          afterState: JSON.parse(JSON.stringify(transaction))
        }
      });

      return transaction;
    });
  }

  static async delete(userId: string, transactionId: string) {
    return prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findFirst({
        where: { id: transactionId, userId, deletedAt: null }
      });

      if (!transaction) {
        throw AppError.notFound('Transacción no encontrada o ya eliminada');
      }

      // Revertir efecto en saldos
      await LedgerService.revertTransaction(tx, {
        userId,
        type: transaction.type as TransactionType,
        amount: transaction.amount,
        accountId: transaction.accountId,
        toAccountId: transaction.toAccountId
      });

      // Soft delete
      const deleted = await tx.transaction.update({
        where: { id: transactionId },
        data: { deletedAt: new Date() }
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          userId,
          entityType: 'Transaction',
          entityId: transactionId,
          action: 'DELETE',
          beforeState: JSON.parse(JSON.stringify(transaction))
        }
      });

      return deleted;
    });
  }

  static async deleteAll(userId: string) {
    return prisma.$transaction(async (tx) => {
      await tx.transportLog.deleteMany({ where: { userId } });
      await tx.transaction.deleteMany({ where: { userId } });
      await tx.account.updateMany({
        where: { userId },
        data: { balance: 0.0 }
      });
      return { success: true, message: 'Todas las transacciones han sido eliminadas y los saldos restablecidos a 0' };
    });
  }
}
