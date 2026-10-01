import { prisma } from '../../config/prisma.js';
import { CreateDebtInput, RecordDebtPaymentInput, CreateLoanInput, RecordLoanCollectionInput, LoanType, Currency, TransactionType, TransactionSource, TransactionStatus } from '@micualto/shared';
import { AppError } from '../../utils/AppError.js';
import { subtractMoney, addMoney, sumMoneyList } from '@micualto/shared';
import { TransactionsService } from '../transactions/transactions.service.js';

export class DebtsService {
  /**
   * Resumen global de deudas y cuentas por cobrar
   */
  static async getSummary(userId: string) {
    const [debts, loans] = await Promise.all([
      prisma.debt.findMany({
        where: { userId },
        select: { remainingAmount: true, totalAmount: true, currency: true },
      }),
      prisma.loan.findMany({
        where: { userId, isSettled: false },
        select: { remainingAmount: true, amount: true, type: true, currency: true },
      }),
    ]);

    const totalI_OweDOP = sumMoneyList(
      debts.filter((d: any) => d.currency === Currency.DOP).map((d: any) => Number(d.remainingAmount))
    );
    const totalI_OweUSD = sumMoneyList(
      debts.filter((d: any) => d.currency === Currency.USD).map((d: any) => Number(d.remainingAmount))
    );

    const loansLent = loans.filter((l: any) => l.type === LoanType.I_LENT);
    const totalOwedToMeDOP = sumMoneyList(
      loansLent.filter((l: any) => l.currency === Currency.DOP).map((l: any) => Number(l.remainingAmount))
    );
    const totalOwedToMeUSD = sumMoneyList(
      loansLent.filter((l: any) => l.currency === Currency.USD).map((l: any) => Number(l.remainingAmount))
    );

    return {
      totalI_Owe: totalI_OweDOP,
      totalI_OweUSD,
      totalOwedToMe: totalOwedToMeDOP,
      totalOwedToMeUSD,
      netBalanceDOP: subtractMoney(totalOwedToMeDOP, totalI_OweDOP),
      activeDebtsCount: debts.filter((d: any) => Number(d.remainingAmount) > 0).length,
      activeLoansCount: loansLent.filter((l: any) => Number(l.remainingAmount) > 0).length,
    };
  }

  /**
   * Listar todas las deudas del usuario (Mis Pasivos)
   */
  static async listDebts(userId: string) {
    return prisma.debt.findMany({
      where: { userId },
      include: {
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Crear una nueva deuda
   */
  static async createDebt(userId: string, input: CreateDebtInput) {
    const remaining = input.remainingAmount !== undefined ? input.remainingAmount : input.totalAmount;
    const dueDate = input.dueDate && !isNaN(new Date(input.dueDate).getTime())
      ? new Date(input.dueDate)
      : undefined;

    return prisma.debt.create({
      data: {
        userId,
        creditorName: input.creditorName.trim(),
        totalAmount: String(input.totalAmount),
        remainingAmount: String(remaining),
        currency: input.currency,
        interestRate: input.interestRate !== undefined ? String(input.interestRate) : undefined,
        totalInstallments: input.totalInstallments,
        paidInstallments: input.paidInstallments,
        dueDate,
      },
      include: { payments: true },
    });
  }

  /**
   * Registrar un abono o pago a una deuda
   */
  static async recordDebtPayment(userId: string, debtId: string, input: RecordDebtPaymentInput) {
    const debt = await prisma.debt.findFirst({
      where: { id: debtId, userId },
    });

    if (!debt) throw AppError.notFound('Deuda no encontrada');

    const currentRemaining = Number(debt.remainingAmount);
    const newRemaining = Math.max(0, subtractMoney(currentRemaining, input.amount));
    const newPaidInstallments = (debt.paidInstallments || 0) + 1;

    // Si se especifica cuenta bancaria de origen, crear el movimiento contable en el Ledger
    let transactionId: string | undefined;
    if (input.accountId) {
      const tx = await TransactionsService.create(userId, {
        type: TransactionType.EXPENSE,
        amount: String(input.amount),
        currency: debt.currency as Currency,
        fxRate: 1.0,
        status: TransactionStatus.CONFIRMED,
        accountId: input.accountId,
        notes: `Abono a deuda: ${debt.creditorName}${input.notes ? ` - ${input.notes}` : ''}`,
        occurredAt: (input.paymentDate ? new Date(input.paymentDate) : new Date()).toISOString(),
        source: TransactionSource.MANUAL,
      });
      transactionId = tx.id;
    } else {
      const userAccounts = await prisma.account.findMany({ where: { userId, isArchived: false } });
      const fallbackAccount = userAccounts[0];
      if (fallbackAccount) {
        const tx = await TransactionsService.create(userId, {
          type: TransactionType.EXPENSE,
          amount: String(input.amount),
          currency: debt.currency as Currency,
          fxRate: 1.0,
          status: TransactionStatus.CONFIRMED,
          accountId: fallbackAccount.id,
          notes: `Abono a deuda: ${debt.creditorName}`,
          occurredAt: (input.paymentDate ? new Date(input.paymentDate) : new Date()).toISOString(),
          source: TransactionSource.MANUAL,
        });
        transactionId = tx.id;
      }
    }

    // Actualizar la deuda y registrar el pago
    const [updatedDebt, payment] = await prisma.$transaction([
      prisma.debt.update({
        where: { id: debtId },
        data: {
          remainingAmount: String(newRemaining),
          paidInstallments: newPaidInstallments,
        },
      }),
      prisma.debtPayment.create({
        data: {
          debtId,
          transactionId: transactionId || debtId, // Fallback safe
          amount: String(input.amount),
          principalPart: String(input.principalPart || input.amount),
          interestPart: String(input.interestPart || 0),
          paymentDate: input.paymentDate ? new Date(input.paymentDate) : new Date(),
        },
      }),
    ]);

    return { debt: updatedDebt, payment };
  }

  /**
   * Listar préstamos (Dinero que me deben)
   */
  static async listLoans(userId: string) {
    return prisma.loan.findMany({
      where: { userId },
      include: {
        person: true,
        collections: {
          orderBy: { date: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Registrar un préstamo que otorgué a alguien (Me deben)
   */
  static async createLoan(userId: string, input: CreateLoanInput) {
    const personName = (input.personName || input.borrowerName || '').trim();
    if (!personName) {
      throw AppError.badRequest('El nombre de la persona o deudor es requerido');
    }

    const concept = input.concept || input.notes;
    const expectedDateStr = input.expectedDate || input.dueDate;
    const expectedDate = expectedDateStr && !isNaN(new Date(expectedDateStr).getTime())
      ? new Date(expectedDateStr)
      : undefined;

    // Buscar o crear la persona asociada
    let person = await prisma.person.findFirst({
      where: { userId, name: personName },
    });

    if (!person) {
      person = await prisma.person.create({
        data: {
          userId,
          name: personName,
          phone: input.personPhone,
          notes: concept,
        },
      });
    }

    // Si se especificó cuenta de origen, generar movimiento en el ledger
    let transactionId: string | undefined;
    if (input.accountId) {
      const tx = await TransactionsService.create(userId, {
        type: TransactionType.EXPENSE,
        amount: String(input.amount),
        currency: input.currency,
        fxRate: 1.0,
        status: TransactionStatus.CONFIRMED,
        accountId: input.accountId,
        notes: `Préstamo otorgado a ${personName}${concept ? ` [${concept}]` : ''}`,
        occurredAt: new Date().toISOString(),
        source: TransactionSource.MANUAL,
      });
      transactionId = tx.id;
    }

    return prisma.loan.create({
      data: {
        userId,
        personId: person.id,
        type: LoanType.I_LENT,
        amount: String(input.amount),
        remainingAmount: String(input.amount),
        currency: input.currency,
        expectedDate,
        concept,
        isSettled: false,
      },
      include: { person: true, collections: true },
    });
  }

  /**
   * Registrar un cobro o abono recibido de una persona que me debe
   */
  static async recordLoanCollection(userId: string, loanId: string, input: RecordLoanCollectionInput) {
    const loan = await prisma.loan.findFirst({
      where: { id: loanId, userId },
      include: { person: true },
    });

    if (!loan) throw AppError.notFound('Préstamo no encontrado');

    const currentRemaining = Number(loan.remainingAmount);
    const newRemaining = Math.max(0, subtractMoney(currentRemaining, input.amount));
    const isSettled = newRemaining === 0;

    // Si se especificó cuenta destino, generar ingreso en el ledger
    let transactionId: string | undefined;
    if (input.accountId) {
      const tx = await TransactionsService.create(userId, {
        type: TransactionType.INCOME,
        amount: String(input.amount),
        currency: loan.currency as Currency,
        fxRate: 1.0,
        status: TransactionStatus.CONFIRMED,
        accountId: input.accountId,
        notes: `Cobro recibido de ${loan.person.name}${input.notes ? ` [${input.notes}]` : ''}`,
        occurredAt: (input.collectionDate ? new Date(input.collectionDate) : new Date()).toISOString(),
        source: TransactionSource.MANUAL,
      });
      transactionId = tx.id;
    } else {
      const userAccounts = await prisma.account.findMany({ where: { userId, isArchived: false } });
      const fallbackAccount = userAccounts[0];
      if (fallbackAccount) {
        const tx = await TransactionsService.create(userId, {
          type: TransactionType.INCOME,
          amount: String(input.amount),
          currency: loan.currency as Currency,
          fxRate: 1.0,
          status: TransactionStatus.CONFIRMED,
          accountId: fallbackAccount.id,
          notes: `Cobro de préstamo: ${loan.person.name}`,
          occurredAt: (input.collectionDate ? new Date(input.collectionDate) : new Date()).toISOString(),
          source: TransactionSource.MANUAL,
        });
        transactionId = tx.id;
      }
    }

    const [updatedLoan, collection] = await prisma.$transaction([
      prisma.loan.update({
        where: { id: loanId },
        data: {
          remainingAmount: String(newRemaining),
          isSettled,
        },
      }),
      prisma.loanCollection.create({
        data: {
          loanId,
          transactionId: transactionId || loanId,
          amount: String(input.amount),
          date: input.collectionDate ? new Date(input.collectionDate) : new Date(),
        },
      }),
    ]);

    return { loan: updatedLoan, collection };
  }

  /**
   * Eliminar una deuda individual
   */
  static async deleteDebt(userId: string, debtId: string) {
    const debt = await prisma.debt.findFirst({
      where: { id: debtId, userId },
    });
    if (!debt) throw AppError.notFound('Deuda no encontrada');

    await prisma.debtPayment.deleteMany({ where: { debtId } });
    await prisma.debt.delete({ where: { id: debtId } });
    return { success: true, id: debtId };
  }

  /**
   * Eliminar todas las deudas del usuario (1 Click)
   */
  static async deleteAllDebts(userId: string) {
    await prisma.debtPayment.deleteMany({ where: { debt: { userId } } });
    const result = await prisma.debt.deleteMany({ where: { userId } });
    return { success: true, deletedCount: result.count };
  }

  /**
   * Eliminar múltiples deudas seleccionadas
   */
  static async bulkDeleteDebts(userId: string, ids: string[]) {
    await prisma.debtPayment.deleteMany({ where: { debtId: { in: ids }, debt: { userId } } });
    const result = await prisma.debt.deleteMany({ where: { id: { in: ids }, userId } });
    return { success: true, deletedCount: result.count };
  }

  /**
   * Eliminar un préstamo individual
   */
  static async deleteLoan(userId: string, loanId: string) {
    const loan = await prisma.loan.findFirst({
      where: { id: loanId, userId },
    });
    if (!loan) throw AppError.notFound('Préstamo no encontrado');

    await prisma.loanCollection.deleteMany({ where: { loanId } });
    await prisma.loan.delete({ where: { id: loanId } });
    return { success: true, id: loanId };
  }

  /**
   * Eliminar todos los préstamos del usuario (1 Click)
   */
  static async deleteAllLoans(userId: string) {
    await prisma.loanCollection.deleteMany({ where: { loan: { userId } } });
    const result = await prisma.loan.deleteMany({ where: { userId } });
    return { success: true, deletedCount: result.count };
  }

  /**
   * Eliminar múltiples préstamos seleccionados
   */
  static async bulkDeleteLoans(userId: string, ids: string[]) {
    await prisma.loanCollection.deleteMany({ where: { loanId: { in: ids }, loan: { userId } } });
    const result = await prisma.loan.deleteMany({ where: { id: { in: ids }, userId } });
    return { success: true, deletedCount: result.count };
  }
}
