import { prisma } from '../../config/prisma.js';
import {
  CreateQuincenaPlanInput,
  UpdateQuincenaPlanInput,
  CreateAllocationInput,
  UpdateAllocationInput,
  GenerateMonthQuincenasInput,
  calculateQuincenaSummary,
  QuincenaStatus,
  AllocationCategory,
  Currency,
} from '@micualto/shared';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export class QuincenasService {
  /**
   * Listar planes de quincenas de un usuario con resumen financiero calculado
   */
  static async list(userId: string, year?: number, month?: number) {
    const where: any = { userId };
    if (year) where.year = Number(year);
    if (month) where.month = Number(month);

    const plans = await prisma.quincenaPlan.findMany({
      where,
      include: {
        allocations: {
          orderBy: [
            { isPaid: 'asc' },
            { dueDate: 'asc' },
            { createdAt: 'asc' },
          ],
        },
      },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' },
        { periodNumber: 'desc' },
      ],
    });

    return plans.map((plan) => {
      const summary = calculateQuincenaSummary({
        expectedIncome: Number(plan.expectedIncome),
        actualIncome: plan.actualIncome ? Number(plan.actualIncome) : null,
        allocations: plan.allocations.map((a) => ({
          expectedAmount: Number(a.expectedAmount),
          actualAmount: a.actualAmount ? Number(a.actualAmount) : null,
          isPaid: a.isPaid,
        })),
      });

      return {
        ...plan,
        expectedIncome: Number(plan.expectedIncome),
        actualIncome: plan.actualIncome ? Number(plan.actualIncome) : null,
        allocations: plan.allocations.map((a) => ({
          ...a,
          expectedAmount: Number(a.expectedAmount),
          actualAmount: a.actualAmount ? Number(a.actualAmount) : null,
        })),
        summary,
      };
    });
  }

  /**
   * Obtener detalle de una quincena por ID
   */
  static async getById(userId: string, id: string) {
    const plan = await prisma.quincenaPlan.findFirst({
      where: { id, userId },
      include: {
        allocations: {
          orderBy: [
            { isPaid: 'asc' },
            { dueDate: 'asc' },
            { createdAt: 'asc' },
          ],
        },
      },
    });

    if (!plan) {
      throw new Error('Plan de quincena no encontrado.');
    }

    const summary = calculateQuincenaSummary({
      expectedIncome: Number(plan.expectedIncome),
      actualIncome: plan.actualIncome ? Number(plan.actualIncome) : null,
      allocations: plan.allocations.map((a) => ({
        expectedAmount: Number(a.expectedAmount),
        actualAmount: a.actualAmount ? Number(a.actualAmount) : null,
        isPaid: a.isPaid,
      })),
    });

    return {
      ...plan,
      expectedIncome: Number(plan.expectedIncome),
      actualIncome: plan.actualIncome ? Number(plan.actualIncome) : null,
      allocations: plan.allocations.map((a) => ({
        ...a,
        expectedAmount: Number(a.expectedAmount),
        actualAmount: a.actualAmount ? Number(a.actualAmount) : null,
      })),
      summary,
    };
  }

  /**
   * Crear un nuevo plan de quincena manualmente
   */
  static async create(userId: string, data: CreateQuincenaPlanInput) {
    const existing = await prisma.quincenaPlan.findUnique({
      where: {
        userId_year_month_periodNumber: {
          userId,
          year: data.year,
          month: data.month,
          periodNumber: data.periodNumber,
        },
      },
    });

    if (existing) {
      throw new Error(
        `Ya existe un plan para la ${data.periodNumber}ra quincena del mes ${data.month}/${data.year}.`
      );
    }

    const plan = await prisma.quincenaPlan.create({
      data: {
        userId,
        name: data.name,
        periodNumber: data.periodNumber,
        month: data.month,
        year: data.year,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        payDate: new Date(data.payDate),
        expectedIncome: data.expectedIncome,
        actualIncome: data.actualIncome ?? null,
        currency: data.currency || Currency.DOP,
        status: data.status || QuincenaStatus.PLANNED,
        notes: data.notes || null,
      },
      include: {
        allocations: true,
      },
    });

    return this.getById(userId, plan.id);
  }

  /**
   * Generar automáticamente las 2 quincenas de un mes
   */
  static async generateMonthQuincenas(userId: string, data: GenerateMonthQuincenasInput) {
    const { year, month, defaultIncome, currency } = data;

    // Calcular fechas del mes
    const monthDate = new Date(year, month - 1, 1);
    const monthName = format(monthDate, 'MMMM', { locale: es });
    const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

    // Días del mes
    const lastDayOfMonth = new Date(year, month, 0).getDate();

    // 1ra Quincena: 1 al 15
    const q1Start = new Date(year, month - 1, 1);
    const q1End = new Date(year, month - 1, 15);
    const q1Pay = new Date(year, month - 1, 15);

    // 2da Quincena: 16 al último día
    const q2Start = new Date(year, month - 1, 16);
    const q2End = new Date(year, month - 1, lastDayOfMonth);
    const q2Pay = new Date(year, month - 1, lastDayOfMonth);

    const q1Name = `1ra Quincena - ${capitalizedMonth} ${year}`;
    const q2Name = `2da Quincena - ${capitalizedMonth} ${year}`;

    // Upsert 1ra Quincena
    const q1 = await prisma.quincenaPlan.upsert({
      where: {
        userId_year_month_periodNumber: {
          userId,
          year,
          month,
          periodNumber: 1,
        },
      },
      update: {
        expectedIncome: defaultIncome,
      },
      create: {
        userId,
        name: q1Name,
        periodNumber: 1,
        month,
        year,
        startDate: q1Start,
        endDate: q1End,
        payDate: q1Pay,
        expectedIncome: defaultIncome,
        currency: currency || Currency.DOP,
        status: QuincenaStatus.PLANNED,
      },
      include: { allocations: true },
    });

    // Upsert 2da Quincena
    const q2 = await prisma.quincenaPlan.upsert({
      where: {
        userId_year_month_periodNumber: {
          userId,
          year,
          month,
          periodNumber: 2,
        },
      },
      update: {
        expectedIncome: defaultIncome,
      },
      create: {
        userId,
        name: q2Name,
        periodNumber: 2,
        month,
        year,
        startDate: q2Start,
        endDate: q2End,
        payDate: q2Pay,
        expectedIncome: defaultIncome,
        currency: currency || Currency.DOP,
        status: QuincenaStatus.PLANNED,
      },
      include: { allocations: true },
    });

    return [await this.getById(userId, q1.id), await this.getById(userId, q2.id)];
  }

  /**
   * Actualizar plan de quincena
   */
  static async update(userId: string, id: string, data: UpdateQuincenaPlanInput) {
    const plan = await prisma.quincenaPlan.findFirst({
      where: { id, userId },
    });

    if (!plan) {
      throw new Error('Plan de quincena no encontrado.');
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.expectedIncome !== undefined) updateData.expectedIncome = data.expectedIncome;
    if (data.actualIncome !== undefined) updateData.actualIncome = data.actualIncome;
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.payDate !== undefined) updateData.payDate = new Date(data.payDate);

    await prisma.quincenaPlan.update({
      where: { id },
      data: updateData,
    });

    return this.getById(userId, id);
  }

  /**
   * Eliminar plan de quincena
   */
  static async delete(userId: string, id: string) {
    const plan = await prisma.quincenaPlan.findFirst({
      where: { id, userId },
    });

    if (!plan) {
      throw new Error('Plan de quincena no encontrado.');
    }

    await prisma.quincenaPlan.delete({
      where: { id },
    });

    return { success: true };
  }

  static async deleteAll(userId: string) {
    await prisma.quincenaAllocation.deleteMany({ where: { quincenaPlan: { userId } } });
    await prisma.quincenaPlan.deleteMany({ where: { userId } });
    return { success: true, message: 'Todos los planes de quincena han sido eliminados' };
  }

  /**
   * Agregar gasto/asignación a una quincena
   */
  static async addAllocation(userId: string, quincenaPlanId: string, data: CreateAllocationInput) {
    const plan = await prisma.quincenaPlan.findFirst({
      where: { id: quincenaPlanId, userId },
    });

    if (!plan) {
      throw new Error('Plan de quincena no encontrado.');
    }

    const allocation = await prisma.quincenaAllocation.create({
      data: {
        quincenaPlanId,
        name: data.name,
        category: data.category || AllocationCategory.FIXED_EXPENSE,
        expectedAmount: data.expectedAmount,
        actualAmount: data.actualAmount ?? null,
        isPaid: data.isPaid || false,
        paidAt: data.isPaid ? new Date() : null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        priority: data.priority || 'HIGH',
        notes: data.notes || null,
        linkedDebtId: data.linkedDebtId || null,
        linkedSubscriptionId: data.linkedSubscriptionId || null,
        linkedGoalId: data.linkedGoalId || null,
      },
    });

    return allocation;
  }

  /**
   * Actualizar una asignación/gasto
   */
  static async updateAllocation(userId: string, allocationId: string, data: UpdateAllocationInput) {
    const allocation = await prisma.quincenaAllocation.findUnique({
      where: { id: allocationId },
      include: { quincenaPlan: true },
    });

    if (!allocation || allocation.quincenaPlan.userId !== userId) {
      throw new Error('Asignación no encontrada.');
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.expectedAmount !== undefined) updateData.expectedAmount = data.expectedAmount;
    if (data.actualAmount !== undefined) updateData.actualAmount = data.actualAmount;
    if (data.isPaid !== undefined) {
      updateData.isPaid = data.isPaid;
      updateData.paidAt = data.isPaid ? new Date() : null;
    }
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.notes !== undefined) updateData.notes = data.notes;

    const updated = await prisma.quincenaAllocation.update({
      where: { id: allocationId },
      data: updateData,
    });

    return updated;
  }

  /**
   * Alternar estado pagado (1-click toggle)
   */
  static async togglePaid(userId: string, allocationId: string) {
    const allocation = await prisma.quincenaAllocation.findUnique({
      where: { id: allocationId },
      include: { quincenaPlan: true },
    });

    if (!allocation || allocation.quincenaPlan.userId !== userId) {
      throw new Error('Asignación no encontrada.');
    }

    const nextPaid = !allocation.isPaid;

    const updated = await prisma.quincenaAllocation.update({
      where: { id: allocationId },
      data: {
        isPaid: nextPaid,
        paidAt: nextPaid ? new Date() : null,
        actualAmount: nextPaid && !allocation.actualAmount ? allocation.expectedAmount : allocation.actualAmount,
      },
    });

    return updated;
  }

  /**
   * Eliminar asignación
   */
  static async deleteAllocation(userId: string, allocationId: string) {
    const allocation = await prisma.quincenaAllocation.findUnique({
      where: { id: allocationId },
      include: { quincenaPlan: true },
    });

    if (!allocation || allocation.quincenaPlan.userId !== userId) {
      throw new Error('Asignación no encontrada.');
    }

    await prisma.quincenaAllocation.delete({
      where: { id: allocationId },
    });

    return { success: true };
  }

  /**
   * Importar obligaciones pendientes (deudas activas y suscripciones)
   */
  static async importPendingCommitments(userId: string, quincenaPlanId: string) {
    const plan = await prisma.quincenaPlan.findFirst({
      where: { id: quincenaPlanId, userId },
      include: { allocations: true },
    });

    if (!plan) {
      throw new Error('Plan de quincena no encontrado.');
    }

    const existingNames = new Set(plan.allocations.map((a) => a.name.toLowerCase().trim()));
    const imported: any[] = [];

    // 1. Deudas con saldo pendiente
    const activeDebts = await prisma.debt.findMany({
      where: {
        userId,
        remainingAmount: { gt: 0 },
      },
    });

    for (const debt of activeDebts) {
      const debtName = `Cuota: ${debt.creditorName}`;
      if (!existingNames.has(debtName.toLowerCase().trim())) {
        // Estimar monto de cuota
        const estQuota = debt.totalInstallments && debt.totalInstallments > 0
          ? Number(debt.totalAmount) / debt.totalInstallments
          : Number(debt.remainingAmount);

        const created = await prisma.quincenaAllocation.create({
          data: {
            quincenaPlanId,
            name: debtName,
            category: AllocationCategory.DEBT_CREDIT_CARD,
            expectedAmount: Math.round(estQuota * 100) / 100,
            priority: 'HIGH',
            linkedDebtId: debt.id,
            notes: `Importado desde Deudas (Saldo: RD$ ${Number(debt.remainingAmount).toLocaleString()})`,
          },
        });
        imported.push(created);
        existingNames.add(debtName.toLowerCase().trim());
      }
    }

    // 2. Suscripciones activas
    const subscriptions = await prisma.subscription.findMany({
      where: { userId, isActive: true },
    });

    for (const sub of subscriptions) {
      const subName = `Suscripción: ${sub.name}`;
      if (!existingNames.has(subName.toLowerCase().trim())) {
        const created = await prisma.quincenaAllocation.create({
          data: {
            quincenaPlanId,
            name: subName,
            category: AllocationCategory.FIXED_EXPENSE,
            expectedAmount: Number(sub.amount),
            priority: 'MEDIUM',
            linkedSubscriptionId: sub.id,
          },
        });
        imported.push(created);
        existingNames.add(subName.toLowerCase().trim());
      }
    }

    return {
      importedCount: imported.length,
      imported,
      plan: await this.getById(userId, quincenaPlanId),
    };
  }

  /**
   * Vincular o registrar automáticamente un ingreso de nómina detectado por correo
   */
  static async autoSyncPayrollIncome(
    userId: string,
    amount: number,
    date: Date = new Date(),
    transactionId?: string
  ) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    // Determinar período de la quincena: días 1 a 15 -> período 1; días 16 en adelante -> período 2
    const periodNumber = day <= 15 ? 1 : 2;

    const monthDate = new Date(year, month - 1, 1);
    const monthName = format(monthDate, 'MMMM', { locale: es });
    const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    const planName = `${periodNumber}ra Quincena - ${capitalizedMonth} ${year}`;

    const lastDayOfMonth = new Date(year, month, 0).getDate();
    const startDate = periodNumber === 1 ? new Date(year, month - 1, 1) : new Date(year, month - 1, 16);
    const endDate = periodNumber === 1 ? new Date(year, month - 1, 15) : new Date(year, month - 1, lastDayOfMonth);

    const plan = await prisma.quincenaPlan.upsert({
      where: {
        userId_year_month_periodNumber: {
          userId,
          year,
          month,
          periodNumber,
        },
      },
      update: {
        actualIncome: amount,
        status: QuincenaStatus.RECEIVED,
        detectedTransactionId: transactionId || undefined,
        payDate: date,
      },
      create: {
        userId,
        name: planName,
        periodNumber,
        month,
        year,
        startDate,
        endDate,
        payDate: date,
        expectedIncome: amount,
        actualIncome: amount,
        currency: Currency.DOP,
        status: QuincenaStatus.RECEIVED,
        detectedTransactionId: transactionId || null,
        notes: `Nómina registrada automáticamente desde correo bancario (${format(date, 'dd/MM/yyyy')})`,
      },
      include: { allocations: true },
    });

    return this.getById(userId, plan.id);
  }

  /**
   * Aplicar y guardar un Cuadre de Quincena (Simulación interactiva y ajuste en lote)
   */
  static async applyCuadre(
    userId: string,
    quincenaPlanId: string,
    data: {
      income?: number;
      allocations: Array<{
        id?: string;
        name: string;
        category?: AllocationCategory;
        expectedAmount: number;
        isPaid?: boolean;
        selected?: boolean;
      }>;
    }
  ) {
    const plan = await prisma.quincenaPlan.findFirst({
      where: { id: quincenaPlanId, userId },
      include: { allocations: true },
    });

    if (!plan) {
      throw new Error('Plan de quincena no encontrado.');
    }

    // 1. Actualizar ingreso si se especificó
    if (data.income !== undefined && !isNaN(data.income) && data.income >= 0) {
      await prisma.quincenaPlan.update({
        where: { id: quincenaPlanId },
        data: { expectedIncome: data.income },
      });
    }

    // 2. Procesar asignaciones
    for (const alloc of data.allocations) {
      if (alloc.id) {
        if (alloc.selected === false) {
          // Deseleccionado en el cuadre: eliminar de esta quincena
          await prisma.quincenaAllocation.delete({
            where: { id: alloc.id },
          }).catch(() => {});
        } else {
          // Actualizar monto y propiedades
          await prisma.quincenaAllocation.update({
            where: { id: alloc.id },
            data: {
              name: alloc.name,
              expectedAmount: alloc.expectedAmount,
              category: alloc.category || AllocationCategory.FIXED_EXPENSE,
              isPaid: alloc.isPaid !== undefined ? alloc.isPaid : undefined,
            },
          }).catch(() => {});
        }
      } else if (alloc.selected !== false && alloc.name && alloc.name.trim()) {
        // Nueva asignación agregada en el cuadre
        await prisma.quincenaAllocation.create({
          data: {
            quincenaPlanId,
            name: alloc.name.trim(),
            category: alloc.category || AllocationCategory.FIXED_EXPENSE,
            expectedAmount: alloc.expectedAmount || 0,
            priority: 'HIGH',
            notes: 'Asignado desde Cuadre de Quincena',
          },
        });
      }
    }

    return this.getById(userId, quincenaPlanId);
  }
}
