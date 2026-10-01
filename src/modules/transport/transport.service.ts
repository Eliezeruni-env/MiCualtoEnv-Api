import { prisma } from '../../config/prisma.js';
import { CreateTransportLogInput, TransactionType, TransactionSource, Currency, TransactionStatus } from '@micualto/shared';
import { TransactionsService } from '../transactions/transactions.service.js';
import Decimal from 'decimal.js';

export class TransportService {
  static async list(userId: string) {
    return prisma.transportLog.findMany({
      where: { userId },
      include: {
        transaction: {
          include: {
            account: { include: { bank: true } },
            category: true
          }
        }
      },
      orderBy: { tripDate: 'desc' }
    });
  }

  static async create(userId: string, input: CreateTransportLogInput) {
    // Buscar o crear categoría de Transporte
    let transportCategory = await prisma.category.findFirst({
      where: {
        isTransport: true,
        OR: [{ userId }, { isSystem: true }]
      }
    });

    if (!transportCategory) {
      transportCategory = await prisma.category.create({
        data: {
          name: 'Transporte & Movilidad',
          slug: 'transporte-movilidad',
          icon: 'car',
          color: '#0284c7',
          isTransport: true,
          isSystem: true
        }
      });
    }

    // 1. Crear la transacción contable de gasto a través de TransactionsService (que actualiza el Ledger)
    const transaction = await TransactionsService.create(userId, {
      type: TransactionType.EXPENSE,
      amount: input.amount,
      currency: Currency.DOP,
      fxRate: 1.0,
      accountId: input.accountId,
      categoryId: transportCategory.id,
      notes: input.notes || `Viaje en ${input.serviceType}${input.origin ? ` (${input.origin} -> ${input.destination || ''})` : ''}`,
      occurredAt: input.tripDate,
      status: TransactionStatus.CONFIRMED,
      source: TransactionSource.MANUAL
    });

    // 2. Crear el registro especializado de transporte
    const transportLog = await prisma.transportLog.create({
      data: {
        userId,
        transactionId: transaction.id,
        serviceType: input.serviceType,
        origin: input.origin,
        destination: input.destination,
        distanceKm: input.distanceKm,
        notes: input.notes,
        tripDate: new Date(input.tripDate)
      },
      include: {
        transaction: {
          include: { account: true, category: true }
        }
      }
    });

    return transportLog;
  }

  static async getStats(userId: string) {
    const logs = await prisma.transportLog.findMany({
      where: { userId },
      include: { transaction: true }
    });

    let totalSpent = new Decimal(0);
    const serviceBreakdown: Record<string, { count: number; total: Decimal }> = {};

    for (const log of logs) {
      const amt = new Decimal(log.transaction.amount.toString());
      totalSpent = totalSpent.plus(amt);

      if (!serviceBreakdown[log.serviceType]) {
        serviceBreakdown[log.serviceType] = { count: 0, total: new Decimal(0) };
      }
      serviceBreakdown[log.serviceType].count += 1;
      serviceBreakdown[log.serviceType].total = serviceBreakdown[log.serviceType].total.plus(amt);
    }

    const formattedBreakdown = Object.entries(serviceBreakdown).map(([service, data]) => ({
      service,
      count: data.count,
      totalAmount: data.total.toNumber(),
      averageTrip: data.count > 0 ? data.total.dividedBy(data.count).toNumber() : 0
    }));

    return {
      totalTrips: logs.length,
      totalSpent: totalSpent.toNumber(),
      averagePerTrip: logs.length > 0 ? totalSpent.dividedBy(logs.length).toNumber() : 0,
      breakdown: formattedBreakdown
    };
  }

  static async delete(userId: string, id: string) {
    const log = await prisma.transportLog.findFirst({
      where: { id, userId }
    });
    if (!log) throw new Error('Registro de transporte no encontrado');
    if (log.transactionId) {
      await TransactionsService.delete(userId, log.transactionId).catch(() => {});
    }
    await prisma.transportLog.delete({ where: { id } });
    return { success: true };
  }

  static async deleteAll(userId: string) {
    await prisma.transportLog.deleteMany({ where: { userId } });
    return { success: true, message: 'Todos los registros de transporte han sido eliminados' };
  }
}
