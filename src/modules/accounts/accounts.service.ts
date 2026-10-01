import { prisma } from '../../config/prisma.js';
import { CreateAccountInput } from '@micualto/shared';
import { AppError } from '../../utils/AppError.js';

export class AccountsService {
  static async listByUser(userId: string) {
    const accounts = await prisma.account.findMany({
      where: { userId, isArchived: false },
      include: {
        bank: true
      },
      orderBy: { createdAt: 'asc' }
    });

    return accounts.map((a) => ({
      ...a,
      balance: a.balance !== null && a.balance !== undefined ? Number(a.balance) : 0,
      creditLimit: a.creditLimit !== null && a.creditLimit !== undefined ? Number(a.creditLimit) : null,
      interestRate: a.interestRate !== null && a.interestRate !== undefined ? Number(a.interestRate) : null,
    }));
  }

  static async getById(userId: string, accountId: string) {
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId },
      include: { bank: true }
    });

    if (!account) {
      throw AppError.notFound('Cuenta no encontrada');
    }

    return {
      ...account,
      balance: account.balance !== null && account.balance !== undefined ? Number(account.balance) : 0,
      creditLimit: account.creditLimit !== null && account.creditLimit !== undefined ? Number(account.creditLimit) : null,
      interestRate: account.interestRate !== null && account.interestRate !== undefined ? Number(account.interestRate) : null,
    };
  }

  static async create(userId: string, input: CreateAccountInput) {
    return prisma.account.create({
      data: {
        userId,
        name: input.name,
        type: input.type,
        currency: input.currency,
        balance: input.balance,
        bankId: input.bankId,
        creditLimit: input.creditLimit,
        statementDay: input.statementDay,
        dueDay: input.dueDay,
        interestRate: input.interestRate,
        last4: input.last4,
        color: input.color
      },
      include: { bank: true }
    });
  }

  static async listBanks() {
    return prisma.bank.findMany({
      orderBy: { name: 'asc' }
    });
  }

  static async delete(userId: string, accountId: string) {
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId }
    });
    if (!account) throw AppError.notFound('Cuenta no encontrada');

    return prisma.$transaction(async (tx) => {
      await tx.transaction.deleteMany({
        where: {
          OR: [{ accountId }, { toAccountId: accountId }]
        }
      });
      await tx.account.delete({ where: { id: accountId } });
      return { success: true };
    });
  }

  static async resetAll(userId: string) {
    await prisma.account.updateMany({
      where: { userId },
      data: { balance: 0.0 }
    });
    return { success: true, message: 'Balances de todas las cuentas restablecidos a 0.00' };
  }
}
