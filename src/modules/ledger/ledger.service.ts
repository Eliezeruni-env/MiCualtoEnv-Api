import { Prisma, PrismaClient } from '@prisma/client';
import Decimal from 'decimal.js';
import { TransactionType, AccountType } from '@micualto/shared';
import { AppError } from '../../utils/AppError.js';

export class LedgerService {
  /**
   * Aplica el impacto de una transacción en las cuentas correspondientes de forma atómica
   */
  static async applyTransaction(
    tx: Prisma.TransactionClient,
    params: {
      userId: string;
      type: TransactionType;
      amount: Decimal;
      accountId: string;
      toAccountId?: string | null;
    }
  ) {
    const { userId, type, amount, accountId, toAccountId } = params;

    const sourceAccount = await tx.account.findFirst({
      where: { id: accountId, userId }
    });

    if (!sourceAccount) {
      throw AppError.notFound(`Cuenta de origen no encontrada (${accountId})`);
    }

    const isCreditCard = sourceAccount.type === AccountType.CREDIT_CARD;

    switch (type) {
      case TransactionType.EXPENSE: {
        if (isCreditCard) {
          // En tarjeta de crédito, un gasto aumenta la deuda (balance positivo representa deuda o consumo)
          await tx.account.update({
            where: { id: accountId },
            data: { balance: { increment: amount.toNumber() } }
          });
        } else {
          // En cuenta bancaria o efectivo, disminuye el saldo disponible
          await tx.account.update({
            where: { id: accountId },
            data: { balance: { decrement: amount.toNumber() } }
          });
        }
        break;
      }

      case TransactionType.INCOME: {
        // Ingreso suma directamente al saldo de la cuenta
        await tx.account.update({
          where: { id: accountId },
          data: { balance: { increment: amount.toNumber() } }
        });
        break;
      }

      case TransactionType.TRANSFER: {
        if (!toAccountId) {
          throw AppError.badRequest('La transferencia requiere una cuenta de destino');
        }

        const destAccount = await tx.account.findFirst({
          where: { id: toAccountId, userId }
        });

        if (!destAccount) {
          throw AppError.notFound('Cuenta de destino no encontrada');
        }

        // Restar de origen
        await tx.account.update({
          where: { id: accountId },
          data: { balance: { decrement: amount.toNumber() } }
        });

        // Sumar a destino
        await tx.account.update({
          where: { id: toAccountId },
          data: { balance: { increment: amount.toNumber() } }
        });
        break;
      }

      case TransactionType.CARD_PAYMENT: {
        if (!toAccountId) {
          throw AppError.badRequest('El pago de tarjeta requiere la tarjeta de crédito de destino');
        }

        const cardAccount = await tx.account.findFirst({
          where: { id: toAccountId, userId, type: AccountType.CREDIT_CARD }
        });

        if (!cardAccount) {
          throw AppError.badRequest('La cuenta de destino debe ser una tarjeta de crédito válida');
        }

        // Restar del banco origen
        await tx.account.update({
          where: { id: accountId },
          data: { balance: { decrement: amount.toNumber() } }
        });

        // Disminuir la deuda en la tarjeta
        await tx.account.update({
          where: { id: toAccountId },
          data: { balance: { decrement: amount.toNumber() } }
        });
        break;
      }

      case TransactionType.ADJUSTMENT: {
        // Ajuste directo del balance
        await tx.account.update({
          where: { id: accountId },
          data: { balance: amount.toNumber() }
        });
        break;
      }

      default:
        break;
    }
  }

  /**
   * Revierte el impacto de una transacción anterior (para ediciones o eliminaciones)
   */
  static async revertTransaction(
    tx: Prisma.TransactionClient,
    transaction: {
      userId: string;
      type: TransactionType;
      amount: Prisma.Decimal | Decimal;
      accountId: string;
      toAccountId?: string | null;
    }
  ) {
    const amountDecimal = new Decimal(transaction.amount.toString());
    const sourceAccount = await tx.account.findFirst({
      where: { id: transaction.accountId, userId: transaction.userId }
    });

    if (!sourceAccount) return;

    const isCreditCard = sourceAccount.type === AccountType.CREDIT_CARD;

    switch (transaction.type) {
      case TransactionType.EXPENSE: {
        if (isCreditCard) {
          await tx.account.update({
            where: { id: transaction.accountId },
            data: { balance: { decrement: amountDecimal.toNumber() } }
          });
        } else {
          await tx.account.update({
            where: { id: transaction.accountId },
            data: { balance: { increment: amountDecimal.toNumber() } }
          });
        }
        break;
      }

      case TransactionType.INCOME: {
        await tx.account.update({
          where: { id: transaction.accountId },
          data: { balance: { decrement: amountDecimal.toNumber() } }
        });
        break;
      }

      case TransactionType.TRANSFER: {
        if (transaction.toAccountId) {
          await tx.account.update({
            where: { id: transaction.accountId },
            data: { balance: { increment: amountDecimal.toNumber() } }
          });
          await tx.account.update({
            where: { id: transaction.toAccountId },
            data: { balance: { decrement: amountDecimal.toNumber() } }
          });
        }
        break;
      }

      case TransactionType.CARD_PAYMENT: {
        if (transaction.toAccountId) {
          await tx.account.update({
            where: { id: transaction.accountId },
            data: { balance: { increment: amountDecimal.toNumber() } }
          });
          await tx.account.update({
            where: { id: transaction.toAccountId },
            data: { balance: { increment: amountDecimal.toNumber() } }
          });
        }
        break;
      }

      default:
        break;
    }
  }

  /**
   * Recalcula el balance exacto de una cuenta según el historial completo
   */
  static async recomputeBalance(prismaClient: PrismaClient, accountId: string, userId: string) {
    const account = await prismaClient.account.findFirst({
      where: { id: accountId, userId }
    });
    if (!account) throw AppError.notFound('Cuenta no encontrada');

    // Consultar todas las transacciones confirmadas no eliminadas
    const outgoing = await prismaClient.transaction.findMany({
      where: { accountId, userId, deletedAt: null, status: 'CONFIRMED' }
    });

    const incoming = await prismaClient.transaction.findMany({
      where: { toAccountId: accountId, userId, deletedAt: null, status: 'CONFIRMED' }
    });

    let computed = new Decimal(0);

    for (const tx of outgoing) {
      const amt = new Decimal(tx.amount.toString());
      if (account.type === AccountType.CREDIT_CARD) {
        if (tx.type === TransactionType.EXPENSE) computed = computed.plus(amt);
      } else {
        if (tx.type === TransactionType.EXPENSE || tx.type === TransactionType.TRANSFER || tx.type === TransactionType.CARD_PAYMENT) {
          computed = computed.minus(amt);
        } else if (tx.type === TransactionType.INCOME) {
          computed = computed.plus(amt);
        }
      }
    }

    for (const tx of incoming) {
      const amt = new Decimal(tx.amount.toString());
      if (account.type === AccountType.CREDIT_CARD) {
        if (tx.type === TransactionType.CARD_PAYMENT) computed = computed.minus(amt);
      } else {
        if (tx.type === TransactionType.TRANSFER) computed = computed.plus(amt);
      }
    }

    return {
      currentBalance: account.balance,
      recomputedBalance: computed.toString()
    };
  }
}
