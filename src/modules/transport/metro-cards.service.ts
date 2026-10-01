import { prisma } from '../../config/prisma.js';
import { TransactionsService } from '../transactions/transactions.service.js';
import { TransportService } from './transport.service.js';
import { TransactionType, Currency, TransactionStatus, TransactionSource, TransportServiceType } from '@micualto/shared';
import Decimal from 'decimal.js';

export interface CreateMetroCardInput {
  name: string;
  cardNumber?: string;
  initialBalance?: number;
  color?: string;
  cardType?: string; // STANDARD (RD$ 20), STUDENT (RD$ 10), CORREDOR (RD$ 35)
  notes?: string;
}

export interface RechargeMetroCardInput {
  amount: number;
  accountId?: string;
  notes?: string;
  rechargeDate?: string;
}

export interface MetroTripInput {
  serviceType?: TransportServiceType;
  tripsCount?: number;
  tripCost?: number;
  unitCost?: number;
  paymentMethod?: 'METRO_CARD' | 'DEBIT_CREDIT_CARD' | 'CASH';
  cardId?: string;
  accountId?: string;
  origin?: string;
  destination?: string;
  notes?: string;
  tripDate?: string;
}

export class MetroCardsService {
  private static isInitialized = false;

  /**
   * Garantizar que las tablas de tarjetas del metro existan en PostgreSQL
   */
  static async ensureTables() {
    if (this.isInitialized) return;
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS metro_cards (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          card_number VARCHAR(50) NOT NULL,
          name VARCHAR(100) NOT NULL,
          balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
          color VARCHAR(30) NOT NULL DEFAULT '#059669',
          card_type VARCHAR(50) NOT NULL DEFAULT 'STANDARD',
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS metro_card_recharges (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          metro_card_id TEXT NOT NULL REFERENCES metro_cards(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          amount NUMERIC(12, 2) NOT NULL,
          previous_balance NUMERIC(12, 2) NOT NULL,
          new_balance NUMERIC(12, 2) NOT NULL,
          account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
          transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
          notes TEXT,
          recharged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE metro_card_recharges 
        ADD COLUMN IF NOT EXISTS recharged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
      `);

      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_metro_cards_user_id ON metro_cards(user_id);
        CREATE INDEX IF NOT EXISTS idx_metro_card_recharges_card_id ON metro_card_recharges(metro_card_id);
        CREATE INDEX IF NOT EXISTS idx_metro_card_recharges_user_id ON metro_card_recharges(user_id);
      `);

      this.isInitialized = true;
    } catch (err) {
      console.error('Error inicializando tablas de Metro Cards:', err);
    }
  }

  /**
   * Billetera virtual para registrar viajes hechos con tarjeta prepago del metro
   */
  static async getOrCreateMetroWalletAccount(userId: string) {
    let wallet = await prisma.account.findFirst({
      where: {
        userId,
        name: 'Saldo Prepago Metro & OMSA',
        type: 'DIGITAL_WALLET'
      }
    });

    if (!wallet) {
      wallet = await prisma.account.create({
        data: {
          userId,
          name: 'Saldo Prepago Metro & OMSA',
          type: 'DIGITAL_WALLET',
          currency: Currency.DOP,
          balance: 0,
          color: '#059669'
        }
      });
    }

    return wallet;
  }

  /**
   * Listar todas las tarjetas del metro del usuario con estadísticas
   */
  static async list(userId: string) {
    await this.ensureTables();

    const cards: any[] = await prisma.$queryRawUnsafe(`
      SELECT 
        c.id,
        c.user_id as "userId",
        c.card_number as "cardNumber",
        c.name,
        c.balance::float as balance,
        c.color,
        c.card_type as "cardType",
        c.notes,
        c.created_at as "createdAt",
        c.updated_at as "updatedAt",
        COALESCE((SELECT COUNT(*) FROM metro_card_recharges r WHERE r.metro_card_id = c.id), 0)::int as "totalRecharges",
        (SELECT MAX(r.recharged_at) FROM metro_card_recharges r WHERE r.metro_card_id = c.id) as "lastRechargeDate"
      FROM metro_cards c
      WHERE c.user_id = $1
      ORDER BY c.created_at ASC
    `, userId);

    let totalBalance = 0;
    for (const card of cards) {
      totalBalance += Number(card.balance) || 0;
    }

    const rechargesStats: any[] = await prisma.$queryRawUnsafe(`
      SELECT 
        COUNT(*)::int as "count",
        COALESCE(SUM(r.amount), 0)::float as "totalAmount"
      FROM metro_card_recharges r
      INNER JOIN metro_cards c ON c.id = r.metro_card_id
      WHERE r.user_id = $1
    `, userId);

    const totalRecharged = rechargesStats[0]?.totalAmount || 0;
    const totalRechargesCount = rechargesStats[0]?.count || 0;

    return {
      cards,
      stats: {
        totalCards: cards.length,
        totalBalance,
        totalRecharged,
        totalRechargesCount,
        availableTripsEstimated: Math.floor(totalBalance / 20)
      }
    };
  }

  /**
   * Crear una nueva tarjeta del metro
   */
  static async create(userId: string, input: CreateMetroCardInput) {
    await this.ensureTables();

    // Generar número de tarjeta si no se especificó
    let cardNumber = (input.cardNumber || '').trim().toUpperCase();
    if (!cardNumber) {
      const randomDigits = Math.floor(10000000 + Math.random() * 90000000);
      cardNumber = `METRO-${randomDigits}`;
    }

    const name = input.name.trim();
    const initialBalance = Math.max(0, Number(input.initialBalance) || 0);
    const color = input.color || '#059669';
    const cardType = input.cardType || 'STANDARD';
    const notes = input.notes ? input.notes.trim() : null;

    const result: any[] = await prisma.$queryRawUnsafe(`
      INSERT INTO metro_cards (user_id, card_number, name, balance, color, card_type, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING 
        id, 
        user_id as "userId", 
        card_number as "cardNumber", 
        name, 
        balance::float as balance, 
        color, 
        card_type as "cardType", 
        notes, 
        created_at as "createdAt", 
        updated_at as "updatedAt"
    `, userId, cardNumber, name, initialBalance, color, cardType, notes);

    const newCard = result[0];

    // Si tiene balance inicial mayor a 0, registrar la recarga inicial
    if (initialBalance > 0 && newCard) {
      await prisma.$queryRawUnsafe(`
        INSERT INTO metro_card_recharges (metro_card_id, user_id, amount, previous_balance, new_balance, notes)
        VALUES ($1, $2, $3, 0, $3, 'Saldo inicial al crear la tarjeta')
      `, newCard.id, userId, initialBalance);
    }

    return newCard;
  }

  /**
   * Recargar dinero a una tarjeta del metro
   */
  static async recharge(userId: string, cardId: string, input: RechargeMetroCardInput) {
    await this.ensureTables();

    const amount = Number(input.amount);
    if (!amount || amount <= 0) {
      throw new Error('El monto de la recarga debe ser mayor a RD$ 0.00');
    }

    // Obtener la tarjeta
    const cardResult: any[] = await prisma.$queryRawUnsafe(`
      SELECT id, name, card_number as "cardNumber", balance::float as balance 
      FROM metro_cards 
      WHERE id = $1 AND user_id = $2
    `, cardId, userId);

    if (!cardResult || cardResult.length === 0) {
      throw new Error('Tarjeta del Metro no encontrada');
    }

    const card = cardResult[0];
    const previousBalance = Number(card.balance) || 0;
    const newBalance = previousBalance + amount;
    const rechargeDate = input.rechargeDate ? new Date(input.rechargeDate) : new Date();

    let transactionId: string | null = null;

    // Si se especificó una cuenta bancaria/efectivo de pago, registrar el débito contable
    if (input.accountId) {
      // Buscar categoría de Transporte
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

      const tx = await TransactionsService.create(userId, {
        type: TransactionType.EXPENSE,
        amount: String(amount),
        currency: Currency.DOP,
        fxRate: 1.0,
        accountId: input.accountId,
        categoryId: transportCategory.id,
        notes: `Recarga Tarjeta Metro [${card.name} • ${card.cardNumber}]${input.notes ? ` - ${input.notes}` : ''}`,
        occurredAt: rechargeDate.toISOString(),
        status: TransactionStatus.CONFIRMED,
        source: TransactionSource.MANUAL
      });

      transactionId = tx.id;
    }

    // Actualizar balance de la tarjeta
    await prisma.$queryRawUnsafe(`
      UPDATE metro_cards
      SET balance = $1, updated_at = NOW()
      WHERE id = $2 AND user_id = $3
    `, newBalance, cardId, userId);

    // Registrar en el historial de recargas
    const rechargeResult: any[] = await prisma.$queryRawUnsafe(`
      INSERT INTO metro_card_recharges (
        metro_card_id, user_id, amount, previous_balance, new_balance, account_id, transaction_id, notes, recharged_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING 
        id, 
        metro_card_id as "metroCardId", 
        amount::float as amount, 
        previous_balance::float as "previousBalance", 
        new_balance::float as "newBalance", 
        account_id as "accountId", 
        transaction_id as "transactionId", 
        notes, 
        recharged_at as "rechargedAt"
    `, cardId, userId, amount, previousBalance, newBalance, input.accountId || null, transactionId, input.notes || 'Recarga en boletería / máquina OPRET', rechargeDate);

    return {
      success: true,
      card: { ...card, balance: newBalance },
      recharge: rechargeResult[0]
    };
  }

  /**
   * Registrar uno o más viajes en Metro de Santo Domingo o Autobuses OMSA
   * Soporta pago con Tarjeta del Metro (OPRET) o directo con Tarjetas de Débito/Crédito
   */
  static async registerTrip(userId: string, cardId?: string | null, input: MetroTripInput = {}) {
    await this.ensureTables();

    const serviceType = input.serviceType === TransportServiceType.OMSA 
      ? TransportServiceType.OMSA 
      : TransportServiceType.METRO_SANTO_DOMINGO;
      
    const tripsCount = Math.max(1, parseInt(String(input.tripsCount || 1), 10) || 1);
    const serviceLabel = serviceType === TransportServiceType.OMSA ? 'Autobús OMSA' : 'Metro de Santo Domingo';
    
    // Tarifa base por defecto: Metro SD = RD$ 20, OMSA regular = RD$ 15
    let defaultUnitCost = serviceType === TransportServiceType.OMSA ? 15 : 20;

    const paymentMethod = input.paymentMethod || (cardId && cardId !== 'none' && cardId !== 'direct' ? 'METRO_CARD' : 'DEBIT_CREDIT_CARD');

    // Categoría de transporte
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

    const tripDate = input.tripDate ? new Date(input.tripDate) : new Date();

    // ==========================================
    // CASO 1: PAGO CON TARJETA DEL METRO (OPRET)
    // ==========================================
    if (paymentMethod === 'METRO_CARD') {
      const targetCardId = cardId || input.cardId;
      if (!targetCardId || targetCardId === 'none' || targetCardId === 'direct') {
        throw new Error('Debes seleccionar una Tarjeta del Metro para debitar el pasaje');
      }

      const cardResult: any[] = await prisma.$queryRawUnsafe(`
        SELECT id, name, card_number as "cardNumber", balance::float as balance, card_type as "cardType"
        FROM metro_cards 
        WHERE id = $1 AND user_id = $2
      `, targetCardId, userId);

      if (!cardResult || cardResult.length === 0) {
        throw new Error('Tarjeta del Metro no encontrada');
      }

      const card = cardResult[0];
      if (card.cardType === 'STUDENT') defaultUnitCost = 10;
      else if (card.cardType === 'CORREDOR') defaultUnitCost = 35;

      const unitCost = input.unitCost !== undefined && Number(input.unitCost) > 0 
        ? Number(input.unitCost) 
        : defaultUnitCost;

      const totalCost = input.tripCost !== undefined && Number(input.tripCost) > 0 
        ? Number(input.tripCost) 
        : (unitCost * tripsCount);
        
      const currentBalance = Number(card.balance) || 0;

      if (currentBalance < totalCost) {
        throw new Error(`Saldo insuficiente en tu tarjeta "${card.name}" (Saldo disponible: RD$ ${currentBalance.toFixed(2)}). Se requieren RD$ ${totalCost.toFixed(2)} para ${tripsCount} viaje(s). Por favor recarga tu tarjeta o selecciona pagar con tarjeta de débito o crédito.`);
      }

      const newBalance = currentBalance - totalCost;

      // Descontar saldo de la tarjeta del metro
      await prisma.$queryRawUnsafe(`
        UPDATE metro_cards
        SET balance = $1, updated_at = NOW()
        WHERE id = $2 AND user_id = $3
      `, newBalance, targetCardId, userId);

      // Usar billetera virtual prepago para no duplicar el cobro a la cuenta bancaria del usuario
      const walletAccount = await this.getOrCreateMetroWalletAccount(userId);

      const tx = await TransactionsService.create(userId, {
        type: TransactionType.EXPENSE,
        amount: String(totalCost),
        currency: Currency.DOP,
        fxRate: 1.0,
        accountId: walletAccount.id,
        categoryId: transportCategory.id,
        notes: `${tripsCount} viaje(s) en ${serviceLabel} con Tarjeta Metro [${card.name} • ${card.cardNumber}]${input.notes ? ` - ${input.notes}` : ''}`,
        occurredAt: tripDate.toISOString(),
        status: TransactionStatus.CONFIRMED,
        source: TransactionSource.MANUAL
      });

      // Crear registro en TransportLog
      await prisma.transportLog.create({
        data: {
          userId,
          transactionId: tx.id,
          serviceType,
          origin: input.origin || (serviceType === TransportServiceType.OMSA ? 'Parada OMSA' : 'Estación Metro SD'),
          destination: input.destination || (serviceType === TransportServiceType.OMSA ? 'Parada OMSA' : 'Estación Metro SD'),
          notes: `${tripsCount} pasaje(s) pagado(s) con Tarjeta Metro [${card.name}]. ${input.notes || ''}`.trim(),
          tripDate
        }
      });

      return {
        success: true,
        serviceType,
        serviceLabel,
        tripsCount,
        unitCost,
        totalCost,
        paymentMethod: 'METRO_CARD',
        card: { ...card, balance: newBalance },
        deducted: totalCost,
        remainingBalance: newBalance
      };
    }

    // ==========================================================
    // CASO 2: PAGO CON TARJETA DE DÉBITO O CRÉDITO EN VALIDADOR
    // ==========================================================
    const unitCost = input.unitCost !== undefined && Number(input.unitCost) > 0 
      ? Number(input.unitCost) 
      : defaultUnitCost;

    const totalCost = input.tripCost !== undefined && Number(input.tripCost) > 0 
      ? Number(input.tripCost) 
      : (unitCost * tripsCount);

    let paymentAccountId = input.accountId;
    if (!paymentAccountId) {
      // Buscar primera cuenta disponible
      const fallbackAcc = await prisma.account.findFirst({
        where: { userId, isArchived: false },
        orderBy: { createdAt: 'asc' }
      });
      if (!fallbackAcc) {
        throw new Error('No se encontró una cuenta o tarjeta bancaria registrada para realizar el pago');
      }
      paymentAccountId = fallbackAcc.id;
    }

    const payAccount = await prisma.account.findFirst({
      where: { id: paymentAccountId, userId },
      include: { bank: true }
    });

    if (!payAccount) {
      throw new Error('La cuenta o tarjeta seleccionada no existe');
    }

    // Crear la transacción de gasto contable directamente sobre la tarjeta de débito o crédito
    const tx = await TransactionsService.create(userId, {
      type: TransactionType.EXPENSE,
      amount: String(totalCost),
      currency: Currency.DOP,
      fxRate: 1.0,
      accountId: paymentAccountId,
      categoryId: transportCategory.id,
      notes: `Pago en validador: ${tripsCount} viaje(s) en ${serviceLabel} con ${payAccount.name} (${payAccount.bank?.name || 'Tarjeta'})${input.origin ? ` [${input.origin} -> ${input.destination || ''}]` : ''}${input.notes ? ` - ${input.notes}` : ''}`,
      occurredAt: tripDate.toISOString(),
      status: TransactionStatus.CONFIRMED,
      source: TransactionSource.MANUAL
    });

    // Crear registro en TransportLog
    await prisma.transportLog.create({
      data: {
        userId,
        transactionId: tx.id,
        serviceType,
        origin: input.origin || (serviceType === TransportServiceType.OMSA ? 'Parada OMSA' : 'Torniquete Metro SD'),
        destination: input.destination || (serviceType === TransportServiceType.OMSA ? 'Parada OMSA' : 'Estación Metro SD'),
        notes: `${tripsCount} viaje(s) pagado(s) directamente con ${payAccount.name}. ${input.notes || ''}`.trim(),
        tripDate
      }
    });

    return {
      success: true,
      serviceType,
      serviceLabel,
      tripsCount,
      unitCost,
      totalCost,
      paymentMethod: 'DEBIT_CREDIT_CARD',
      accountName: payAccount.name,
      bankName: payAccount.bank?.name,
      deducted: totalCost
    };
  }

  /**
   * Actualizar tarjeta
   */
  static async update(userId: string, cardId: string, input: Partial<CreateMetroCardInput>) {
    await this.ensureTables();

    const existing: any[] = await prisma.$queryRawUnsafe(`
      SELECT id FROM metro_cards WHERE id = $1 AND user_id = $2
    `, cardId, userId);

    if (!existing || existing.length === 0) {
      throw new Error('Tarjeta no encontrada');
    }

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${idx++}`);
      values.push(input.name.trim());
    }
    if (input.cardNumber !== undefined) {
      updates.push(`card_number = $${idx++}`);
      values.push(input.cardNumber.trim().toUpperCase());
    }
    if (input.color !== undefined) {
      updates.push(`color = $${idx++}`);
      values.push(input.color);
    }
    if (input.cardType !== undefined) {
      updates.push(`card_type = $${idx++}`);
      values.push(input.cardType);
    }
    if (input.notes !== undefined) {
      updates.push(`notes = $${idx++}`);
      values.push(input.notes ? input.notes.trim() : null);
    }

    updates.push(`updated_at = NOW()`);

    values.push(cardId, userId);
    const query = `
      UPDATE metro_cards 
      SET ${updates.join(', ')}
      WHERE id = $${idx++} AND user_id = $${idx++}
      RETURNING 
        id, 
        user_id as "userId", 
        card_number as "cardNumber", 
        name, 
        balance::float as balance, 
        color, 
        card_type as "cardType", 
        notes, 
        created_at as "createdAt", 
        updated_at as "updatedAt"
    `;

    const result: any[] = await prisma.$queryRawUnsafe(query, ...values);
    return result[0];
  }

  /**
   * Eliminar tarjeta del metro
   */
  static async delete(userId: string, cardId: string) {
    await this.ensureTables();

    await prisma.$queryRawUnsafe(`
      DELETE FROM metro_card_recharges WHERE metro_card_id = $1 AND user_id = $2
    `, cardId, userId);

    await prisma.$queryRawUnsafe(`
      DELETE FROM metro_cards WHERE id = $1 AND user_id = $2
    `, cardId, userId);

    return { deleted: true };
  }

  /**
   * Listar historial de recargas de una tarjeta
   */
  static async listRecharges(userId: string, cardId: string) {
    await this.ensureTables();

    const recharges: any[] = await prisma.$queryRawUnsafe(`
      SELECT 
        r.id,
        r.metro_card_id as "metroCardId",
        r.amount::float as amount,
        r.previous_balance::float as "previousBalance",
        r.new_balance::float as "newBalance",
        r.account_id as "accountId",
        r.transaction_id as "transactionId",
        r.notes,
        r.recharged_at as "rechargedAt",
        r.created_at as "createdAt",
        a.name as "accountName",
        b.name as "bankName",
        b.color as "bankColor"
      FROM metro_card_recharges r
      LEFT JOIN accounts a ON a.id = r.account_id
      LEFT JOIN banks b ON b.id = a.bank_id
      WHERE r.metro_card_id = $1 AND r.user_id = $2
      ORDER BY r.recharged_at DESC
    `, cardId, userId);

    return recharges;
  }
}
