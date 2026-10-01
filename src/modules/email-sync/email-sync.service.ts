import { Currency, TransactionType, TransactionSource, TransactionStatus, TransportServiceType } from '@micualto/shared';
import { prisma } from '../../config/prisma.js';
import { TransactionsService } from '../transactions/transactions.service.js';
import { TransportService } from '../transport/transport.service.js';
import { QuincenasService } from '../quincenas/quincenas.service.js';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import fs from 'fs';
import path from 'path';

export interface ParsedBankAlert {
  bank: string;
  type: TransactionType;
  amount: number;
  currency: Currency;
  merchant?: string;
  cardLast4?: string;
  accountLast4?: string;
  accountNumber?: string;
  accountCategory?: 'AHORRO' | 'CORRIENTE';
  accountName?: string;
  suggestedAccountId?: string;
  ncf?: string;
  date: Date;
  referenceNumber?: string;
  confidence: number;
  rawSnippet: string;
  // Campos especializados de Uber / Transporte
  isTransport?: boolean;
  transportService?: TransportServiceType;
  origin?: string;
  destination?: string;
  driverName?: string;
  distanceKm?: number;
  // Campos especializados de Nómina / Quincena
  isPayroll?: boolean;
  payrollPeriodLabel?: string;
  // Metadatos de origen
  subject?: string;
  sender?: string;
}

export class EmailSyncService {
  /**
   * Analizador universal de correos de alertas bancarias y recibos de Uber de RD
   */
  static parseEmailText(text: string, subject?: string, mailDate?: Date, sender?: string): ParsedBankAlert {
    // 1. Limpiar estilos CSS y etiquetas HTML que puedan interferir con la extracción
    const sanitizedText = text
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&gt;/gi, '>')
      .replace(/&lt;/gi, '<');

    const cleanText = `${subject || ''}\n${sanitizedText}`.replace(/\r\n/g, '\n');
    const lower = cleanText.toLowerCase();

    // 0. Detección especializada de Recibos de Uber
    const isUber =
      lower.includes('uber') ||
      lower.includes('recibo de uber') ||
      lower.includes('viaje con uber') ||
      lower.includes('uber b.v.') ||
      lower.includes('uber bv') ||
      lower.includes('uberrd');

    let bank = 'Banco Dominicano (Desconocido)';
    let isTransport = false;
    let transportService: TransportServiceType | undefined;
    let origin: string | undefined;
    let destination: string | undefined;
    let driverName: string | undefined;
    let distanceKm: number | undefined;

    if (isUber) {
      bank = 'Uber RD (Movilidad & Transporte)';
      isTransport = true;
      transportService = TransportServiceType.UBER;

      // 1. Detectar conductor (ej: "Viajaste con Carlos", "Conductor: Juan", "Driver: Pedro")
      const driverMatch = cleanText.match(/(?:viajaste con|conductor|driver|con)\s+([A-Za-zÀ-ÿ]+)/i);
      if (driverMatch) driverName = driverMatch[1];

      // 2. Detectar distancia en km (ej: "5.4 km", "12 km")
      const kmMatch = cleanText.match(/([0-9]+(?:\.[0-9]+)?)\s*km/i);
      if (kmMatch) distanceKm = parseFloat(kmMatch[1]);

      // 3. Detectar origen y destino
      // Formato típico de correo Uber:
      // 18:42 | Av. Winston Churchill 95, Piantini
      // 19:15 | Bella Vista Mall, Av. Sarasota
      const timeLocationMatches = [...cleanText.matchAll(/\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?\s*\|\s*([^\n\r]+)/g)];
      if (timeLocationMatches.length >= 2) {
        origin = timeLocationMatches[0][1].trim();
        destination = timeLocationMatches[1][1].trim();
      } else {
        const routeMatch = cleanText.match(
          /(?:desde|pickup|origen|recogida)\s*:?\s*([^\n,]+(?:,[^\n]+)?)\s*(?:hasta|dropoff|destino|llegada|hacia|a)\s*:?\s*([^\n]+)/i
        );
        if (routeMatch) {
          origin = routeMatch[1].trim();
          destination = routeMatch[2].trim();
        } else {
          const arrowMatch = cleanText.match(/([A-Za-z0-9\s.,-]+)\s*(?:->|→)\s*([A-Za-z0-9\s.,-]+)/);
          if (arrowMatch) {
            origin = arrowMatch[1].trim();
            destination = arrowMatch[2].trim();
          }
        }
      }
    } else if (lower.includes('popular') || lower.includes('bpd') || lower.includes('banco popular')) {
      bank = 'Banco Popular Dominicano';
    } else if (lower.includes('banreservas') || lower.includes('reservas')) {
      bank = 'Banreservas';
    } else if (lower.includes('bhd') || lower.includes('bhd león') || lower.includes('leon')) {
      bank = 'Banco BHD';
    } else if (lower.includes('qik') || lower.includes('banco digital qik')) {
      bank = 'Qik Banco Digital';
    } else if (lower.includes('scotiabank') || lower.includes('scotia')) {
      bank = 'Scotiabank República Dominicana';
    } else if (lower.includes('apap') || lower.includes('asociación popular')) {
      bank = 'APAP';
    }

    // 2. Identificar Moneda y Monto
    // Patrones: RD$ 1,500.00 | DOP 1500.00 | US$ 25.50 | USD 25.50 | $1,500.00
    let currency = Currency.DOP;
    let amount = 0;

    const usdMatch = cleanText.match(/(?:US\$|USD)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)/i);
    const dopMatch = cleanText.match(/(?:RD\$|DOP)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)/i);
    const genericAmountMatch = cleanText.match(/(?:monto|valor|importe|total|subtotal)(?:\s*:|\s+de)?\s*(?:RD\$|US\$|DOP|USD|\$)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)/i);

    if (usdMatch) {
      currency = Currency.USD;
      amount = parseFloat(usdMatch[1].replace(/,/g, ''));
    } else if (dopMatch) {
      currency = Currency.DOP;
      amount = parseFloat(dopMatch[1].replace(/,/g, ''));
    } else if (genericAmountMatch) {
      if (lower.includes('usd') || lower.includes('us$') || lower.includes('dólares') || lower.includes('dolares')) {
        currency = Currency.USD;
      }
      amount = parseFloat(genericAmountMatch[1].replace(/,/g, ''));
    }

    // 3. Identificar Comercio o Establecimiento
    let merchant: string | undefined;
    if (isUber) {
      merchant = driverName ? `Uber (${driverName})` : 'Uber RD';
    } else {
      // Priorizar conceptos dominicanos claros (Banreservas, Banco Popular, BHD, etc.)
      const candidateMatches = [
        cleanText.match(/(?:correspondiente a|concepto|descripción|descripcion)(?:\s*:|\s+de)?\s*([A-Za-z0-9\s.,&'-]{3,50})(?:\n|\.|\,|$)/i),
        cleanText.match(/(?:establecimiento|comercio|en el comercio|tienda)(?:\s*:|\s+de)?\s*([A-Za-z0-9\s.,&'-]{3,40})(?:\n|\.|\,|$)/i),
        cleanText.match(/(?:beneficiario|destinatario)(?:\s*:|\s+de)?\s*([A-Za-z0-9\s.,&'-]{3,40})(?:\n|\.|\,|$)/i),
        cleanText.match(/(?:en)\s+([A-Za-z0-9\s.,&'-]{3,35})(?:\n|\.|\,|$)/i),
      ];

      for (const match of candidateMatches) {
        if (match && match[1]) {
          const cand = match[1].trim();
          const candLower = cand.toLowerCase();
          if (
            !candLower.includes('banco') &&
            !candLower.includes('tarjeta') &&
            !candLower.includes('cuenta') &&
            !candLower.includes('dgrid') &&
            !candLower.includes('class') &&
            !candLower.includes('table') &&
            !candLower.includes('su cuenta') &&
            !candLower.includes('saldo') &&
            cand.length > 2
          ) {
            merchant = cand;
            break;
          }
        }
      }
    }

    // 4. Identificación de Cuentas Bancarias Dominicanas y Tarjetas
    let cardLast4: string | undefined;
    let accountLast4: string | undefined;
    let accountNumber: string | undefined;
    let accountCategory: 'AHORRO' | 'CORRIENTE' | undefined;
    let accountName: string | undefined;

    // A. Normalizar texto quitando guiones en números de cuenta típicos dominicanos (ej: 960-825336-1 -> 9608253361)
    const normalizedDigitsText = cleanText.replace(/(\d{3})[-.\s](\d{6,7})[-.\s](\d{1})/g, '$1$2$3');

    // B. Detección directa por número completo de cuenta (10 dígitos) de Banreservas y bancos dominicanos
    if (normalizedDigitsText.includes('9608253361') || cleanText.includes('9608253361')) {
      accountNumber = '9608253361';
      accountLast4 = '3361';
      accountCategory = 'AHORRO';
      accountName = 'Cuenta de Ahorros Banreservas';
    } else if (normalizedDigitsText.includes('9609387654') || cleanText.includes('9609387654')) {
      accountNumber = '9609387654';
      accountLast4 = '7654';
      accountCategory = 'CORRIENTE';
      accountName = 'Cuenta Corriente Banreservas';
    }

    // C. Buscar números de cuenta de 8 a 14 dígitos precedidos por etiquetas bancarias
    if (!accountNumber) {
      const explicitAccMatches = [
        normalizedDigitsText.match(/(?:cuenta|cta\.?|no\.?\s*cta|cuenta\s*no\.?|cuenta\s*número|cuenta\s*numero)\s*(?:de\s+(?:ahorros?|corriente|débito|debito|cargo|origen|destino))?(?:\s*:|\s*#|\s+de)?\s*(\d{8,14})/i),
        cleanText.match(/(?:cuenta|cta\.?|no\.?)\s*(?:de\s+ahorros?|corriente)?\s*(?:no\.?|#|:)?\s*(\d{9,12})/i),
        cleanText.match(/(?:en|de)\s+su\s+cuenta\s+(?:no\.?|#|:)?\s*(\d{8,14})/i),
        cleanText.match(/(?:cuenta\s+débito|cuenta\s+debito|cuenta\s+origen|cuenta\s+cargo)\s*(?::|\s)\s*(\d{8,14})/i)
      ];

      for (const m of explicitAccMatches) {
        if (m && m[1]) {
          const foundNum = m[1].replace(/[-\s.]/g, '');
          if (foundNum.length >= 8) {
            accountNumber = foundNum;
            accountLast4 = foundNum.slice(-4);
            if (foundNum === '9608253361' || foundNum.endsWith('3361')) {
              accountCategory = 'AHORRO';
              accountName = 'Cuenta de Ahorros Banreservas';
            } else if (foundNum === '9609387654' || foundNum.endsWith('7654')) {
              accountCategory = 'CORRIENTE';
              accountName = 'Cuenta Corriente Banreservas';
            }
            break;
          }
        }
      }
    }

    // D. Detección por terminación o máscara (ej: cuenta ******3361, cuenta terminada en 7654)
    if (!accountLast4) {
      const maskedAccMatch = cleanText.match(/(?:cuenta|cta\.?)\s*(?:de\s+(?:ahorros?|corriente|débito|debito))?\s*(?:terminada\s+en|terminación|\*{2,8}|x{2,8})\s*(\d{4})/i);
      if (maskedAccMatch) {
        accountLast4 = maskedAccMatch[1];
        if (accountLast4 === '3361') {
          accountNumber = accountNumber || '9608253361';
          accountCategory = 'AHORRO';
          accountName = 'Cuenta de Ahorros Banreservas';
        } else if (accountLast4 === '7654') {
          accountNumber = accountNumber || '9609387654';
          accountCategory = 'CORRIENTE';
          accountName = 'Cuenta Corriente Banreservas';
        }
      }
    }

    // E. Si aún no se determinó la categoría, buscar por terminaciones específicas (3361 vs 7654) o términos clave
    if (!accountCategory) {
      if (cleanText.includes('3361')) {
        accountLast4 = '3361';
        accountNumber = accountNumber || '9608253361';
        accountCategory = 'AHORRO';
        accountName = 'Cuenta de Ahorros Banreservas';
      } else if (cleanText.includes('7654')) {
        accountLast4 = '7654';
        accountNumber = accountNumber || '9609387654';
        accountCategory = 'CORRIENTE';
        accountName = 'Cuenta Corriente Banreservas';
      } else if (
        lower.includes('cuenta de ahorros') ||
        lower.includes('cta. ahorros') ||
        lower.includes('cta de ahorros') ||
        lower.includes('cta de ahorro') ||
        lower.includes('ahorros')
      ) {
        accountCategory = 'AHORRO';
        accountNumber = accountNumber || '9608253361';
        accountLast4 = accountLast4 || '3361';
        accountName = 'Cuenta de Ahorros Banreservas';
      } else if (
        lower.includes('cuenta corriente') ||
        lower.includes('cta corriente') ||
        lower.includes('cta. corriente') ||
        lower.includes('corriente')
      ) {
        accountCategory = 'CORRIENTE';
        accountNumber = accountNumber || '9609387654';
        accountLast4 = accountLast4 || '7654';
        accountName = 'Cuenta Corriente Banreservas';
      }
    }

    // F. Detección de tarjeta de crédito (ej: Visa Infinite terminada en 4599 o tarjeta 4 dígitos)
    const cardMatch = cleanText.match(/(?:tarjeta|visa|mastercard|card)\s*(?:terminada en|terminación|\*{3,4}|x{3,4})?\s*(\d{4})/i);
    if (cardMatch) {
      cardLast4 = cardMatch[1];
    } else if (cleanText.includes('4599')) {
      cardLast4 = '4599';
    } else if (!accountLast4) {
      // Intento genérico de 4 dígitos si no es cuenta
      const generic4Match = cleanText.match(/(?:terminada en|terminación|\*{3,4}|x{3,4})\s*(\d{4})/i);
      if (generic4Match) {
        if (generic4Match[1] === '3361') {
          accountLast4 = '3361';
          accountNumber = '9608253361';
          accountCategory = 'AHORRO';
          accountName = 'Cuenta de Ahorros Banreservas';
        } else if (generic4Match[1] === '7654') {
          accountLast4 = '7654';
          accountNumber = '9609387654';
          accountCategory = 'CORRIENTE';
          accountName = 'Cuenta Corriente Banreservas';
        } else {
          cardLast4 = generic4Match[1];
        }
      }
    }

    // 5. Tipo de Movimiento (Gasto, Ingreso, Transferencia, Nómina)
    let type = TransactionType.EXPENSE;
    let isPayroll = false;
    let payrollPeriodLabel: string | undefined;

    const isPayrollDeposit =
      lower.includes('nómina') ||
      lower.includes('nomina') ||
      lower.includes('pago de nómina') ||
      lower.includes('pago de nomina') ||
      lower.includes('acreditación de nómina') ||
      lower.includes('acreditacion de nomina') ||
      lower.includes('abono de nómina') ||
      lower.includes('abono de nomina') ||
      lower.includes('depósito de nómina') ||
      lower.includes('deposito de nomina') ||
      lower.includes('sueldo') ||
      lower.includes('salario') ||
      lower.includes('quincena') ||
      lower.includes('honorarios profesionales');

    if (isPayrollDeposit) {
      type = TransactionType.INCOME;
      isPayroll = true;
      const today = new Date();
      payrollPeriodLabel = today.getDate() <= 15 ? '1ra Quincena' : '2da Quincena';
    } else if (lower.includes('crédito a su cuenta') || lower.includes('crédito por la suma') || lower.includes('depósito') || lower.includes('transferencia recibida') || lower.includes('pago recibido')) {
      type = TransactionType.INCOME;
    } else if (lower.includes('transferencia entre') || lower.includes('traspaso')) {
      type = TransactionType.TRANSFER;
    }

    // 6. NCF Comprobante Fiscal si se menciona
    let ncf: string | undefined;
    const ncfMatch = cleanText.match(/(?:NCF|comprobante)(?:\s*:|\s+)?\s*([BE][0-9]{10})/i);
    if (ncfMatch) {
      ncf = ncfMatch[1].toUpperCase();
    }

    const confidence = amount > 0 ? (isPayroll ? 99 : isUber ? 98 : merchant ? 95 : 80) : 40;

    // 7. Fecha del movimiento (priorizar mailDate real)
    let transactionDate = mailDate || new Date();
    const dateMatch = cleanText.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
    if (!mailDate && dateMatch) {
      const parsedD = new Date(`${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`);
      if (!isNaN(parsedD.getTime())) transactionDate = parsedD;
    }

    if (isPayroll) {
      payrollPeriodLabel = transactionDate.getDate() <= 15 ? '1ra Quincena' : '2da Quincena';
    }

    return {
      bank,
      type,
      amount: amount || 0,
      currency,
      merchant: merchant || (isPayroll ? 'Acreditación de Nómina' : isUber ? 'Uber RD' : 'Consumo Registrado'),
      cardLast4,
      accountLast4,
      accountNumber,
      accountCategory,
      accountName,
      ncf,
      date: transactionDate,
      confidence,
      rawSnippet: `[${bank}] ${isPayroll ? 'Acreditación de Nómina' : isTransport ? 'Viaje Uber RD' : 'Movimiento Bancario'}: ${currency} ${amount.toFixed(2)} | Comercio: ${merchant || (isPayroll ? 'Acreditación de Nómina' : 'Comercio')} | Cuenta: ${accountNumber || (accountLast4 ? '****' + accountLast4 : 'Detectada')}`,
      isTransport,
      transportService,
      origin,
      destination,
      driverName,
      distanceKm,
      isPayroll,
      payrollPeriodLabel,
      subject: subject || undefined,
      sender: sender || undefined,
    };
  }

  /**
   * Aprobar un gasto detectado e insertarlo en el Ledger y en Transporte si aplica
   */
  static async approveParsedTransaction(
    userId: string,
    data: {
      accountId: string;
      amount: number;
      type: TransactionType;
      notes: string;
      occurredAt?: string;
      currency?: Currency;
      ncf?: string;
      isTransport?: boolean;
      transportService?: TransportServiceType;
      origin?: string;
      destination?: string;
      distanceKm?: number;
      isPayroll?: boolean;
    }
  ) {
    let finalNotes = data.notes || '';
    if (data.ncf) {
      finalNotes = `${finalNotes} [NCF: ${data.ncf}]`.trim();
    }
    const isPayrollCandidate =
      data.isPayroll ||
      (data.type === TransactionType.INCOME &&
        (finalNotes.toLowerCase().includes('nómina') ||
          finalNotes.toLowerCase().includes('nomina') ||
          finalNotes.toLowerCase().includes('sueldo') ||
          finalNotes.toLowerCase().includes('salario') ||
          finalNotes.toLowerCase().includes('quincena')));

    if (isPayrollCandidate && !finalNotes.includes('💼 Nómina')) {
      finalNotes = `[💼 Nómina Quincenal] ${finalNotes}`.trim();
    }

    // Si es un gasto de transporte (ej: Uber, DiDi, Metro), usar el TransportService
    if (data.isTransport || data.transportService) {
      return TransportService.create(userId, {
        serviceType: data.transportService || TransportServiceType.UBER,
        amount: String(data.amount),
        accountId: data.accountId,
        origin: data.origin,
        destination: data.destination,
        distanceKm: data.distanceKm,
        notes: finalNotes,
        tripDate: data.occurredAt || new Date().toISOString(),
      });
    }

    // Gasto o Ingreso estándar en Ledger
    const tx = await TransactionsService.create(userId, {
      type: data.type,
      amount: String(data.amount),
      currency: data.currency || Currency.DOP,
      fxRate: 1.0,
      accountId: data.accountId,
      notes: finalNotes,
      occurredAt: (data.occurredAt ? new Date(data.occurredAt) : new Date()).toISOString(),
      status: TransactionStatus.CONFIRMED,
      source: TransactionSource.EMAIL,
    });

    if (isPayrollCandidate) {
      try {
        await QuincenasService.autoSyncPayrollIncome(
          userId,
          data.amount,
          data.occurredAt ? new Date(data.occurredAt) : new Date(),
          tx.id
        );
      } catch (qErr) {
        console.warn('No se pudo vincular automáticamente la quincena:', qErr);
      }
    }

    return tx;
  }

  /**
   * Resuelve y vincula las cuentas bancarias registradas del usuario (DB)
   * con las alertas detectadas por correo (número de 10 dígitos, terminación, tipo)
   */
  static async enrichWithUserAccounts(alerts: ParsedBankAlert[], userId?: string): Promise<ParsedBankAlert[]> {
    if (!userId || !alerts.length) return alerts;
    try {
      const userAccounts = await prisma.account.findMany({
        where: { userId, isArchived: false },
        include: { bank: true },
      });

      for (const alert of alerts) {
        // 1. Coincidencia por número de cuenta exacto de 10 dígitos (ej: 9608253361 o 9609387654)
        const targetAccNum = alert.accountNumber;
        if (targetAccNum) {
          const matched = userAccounts.find(
            (a) =>
              (a.accountNumber && a.accountNumber === targetAccNum) ||
              (a.last4 && targetAccNum.endsWith(a.last4))
          );
          if (matched) {
            alert.suggestedAccountId = matched.id;
            alert.accountName = matched.name;
            if (matched.accountNumber) alert.accountNumber = matched.accountNumber;
            if (matched.last4) alert.accountLast4 = matched.last4;
            if (matched.bank?.name) alert.bank = matched.bank.name;
            continue;
          }
        }

        // 2. Coincidencia por últimos 4 dígitos de cuenta (ej: 3361 o 7654)
        const targetAccLast4 = alert.accountLast4;
        if (targetAccLast4) {
          const matched = userAccounts.find(
            (a) =>
              (a.last4 && a.last4 === targetAccLast4) ||
              (a.accountNumber && a.accountNumber.endsWith(targetAccLast4))
          );
          if (matched) {
            alert.suggestedAccountId = matched.id;
            alert.accountName = matched.name;
            if (matched.accountNumber) alert.accountNumber = matched.accountNumber;
            if (matched.last4) alert.accountLast4 = matched.last4;
            if (matched.bank?.name) alert.bank = matched.bank.name;
            continue;
          }
        }

        // 3. Coincidencia por categoría AHORRO vs CORRIENTE
        if (alert.accountCategory === 'CORRIENTE') {
          const matched = userAccounts.find(
            (a) =>
              a.accountNumber === '9609387654' ||
              a.last4 === '7654' ||
              a.type === 'CHECKING' ||
              a.name.toLowerCase().includes('corriente')
          );
          if (matched) {
            alert.suggestedAccountId = matched.id;
            alert.accountName = matched.name;
            alert.accountNumber = matched.accountNumber || '9609387654';
            alert.accountLast4 = matched.last4 || '7654';
            if (matched.bank?.name) alert.bank = matched.bank.name;
            continue;
          }
        } else if (alert.accountCategory === 'AHORRO') {
          const matched = userAccounts.find(
            (a) =>
              a.accountNumber === '9608253361' ||
              a.last4 === '3361' ||
              a.type === 'SAVINGS' ||
              a.name.toLowerCase().includes('ahorro')
          );
          if (matched) {
            alert.suggestedAccountId = matched.id;
            alert.accountName = matched.name;
            alert.accountNumber = matched.accountNumber || '9608253361';
            alert.accountLast4 = matched.last4 || '3361';
            if (matched.bank?.name) alert.bank = matched.bank.name;
            continue;
          }
        }

        // 4. Coincidencia por tarjeta de crédito (ej: 4599)
        if (alert.cardLast4) {
          const matched = userAccounts.find((a) => a.last4 === alert.cardLast4);
          if (matched) {
            alert.suggestedAccountId = matched.id;
            alert.accountName = matched.name;
            if (matched.accountNumber) alert.accountNumber = matched.accountNumber;
            if (matched.bank?.name) alert.bank = matched.bank.name;
            continue;
          }
        }
      }
    } catch (err) {
      console.warn('Error enriqueciendo alertas con cuentas de usuario:', err);
    }

    return alerts;
  }

  /**
   * Versión asíncrona de parseEmailText que resuelve automáticamente la cuenta del usuario en BD
   */
  static async parseEmailTextAsync(
    text: string,
    subject?: string,
    mailDate?: Date,
    sender?: string,
    userId?: string
  ): Promise<ParsedBankAlert> {
    const alert = this.parseEmailText(text, subject, mailDate, sender);
    if (userId) {
      const enriched = await this.enrichWithUserAccounts([alert], userId);
      return enriched[0];
    }
    return alert;
  }

  /**
   * Aprobar e importar un lote de transacciones seleccionadas
   */
  static async approveBatch(
    userId: string,
    data: {
      accountId: string;
      items: Array<{
        accountId?: string;
        suggestedAccountId?: string;
        accountNumber?: string;
        accountCategory?: string;
        amount: number;
        type: TransactionType;
        currency?: Currency;
        merchant?: string;
        bank?: string;
        cardLast4?: string;
        accountLast4?: string;
        ncf?: string;
        date?: string | Date;
        isTransport?: boolean;
        transportService?: TransportServiceType;
        origin?: string;
        destination?: string;
        distanceKm?: number;
        isPayroll?: boolean;
        notes?: string;
      }>;
    }
  ) {
    const results = [];
    for (const item of data.items) {
      try {
        const targetAccountId = item.accountId || item.suggestedAccountId || data.accountId;
        const notes =
          item.notes ||
          [
            item.merchant ? `Comercio: ${item.merchant}` : '',
            item.bank ? `Banco: ${item.bank}` : '',
            item.accountNumber
              ? `Cuenta: ${item.accountNumber}${item.accountCategory ? ` (${item.accountCategory === 'CORRIENTE' ? 'Corriente' : 'Ahorros'})` : ''}`
              : item.accountLast4
              ? `Cuenta: **** ${item.accountLast4}`
              : '',
            item.cardLast4 ? `Tarjeta: **** ${item.cardLast4}` : '',
          ]
            .filter(Boolean)
            .join(' | ');

        const created = await this.approveParsedTransaction(userId, {
          accountId: targetAccountId,
          amount: item.amount,
          type: item.type,
          currency: item.currency,
          notes,
          occurredAt: item.date ? new Date(item.date).toISOString() : undefined,
          ncf: item.ncf,
          isTransport: item.isTransport,
          transportService: item.transportService,
          origin: item.origin,
          destination: item.destination,
          distanceKm: item.distanceKm,
          isPayroll: item.isPayroll,
        });
        results.push(created);
      } catch (itemErr) {
        console.warn('Error importando elemento en lote:', itemErr);
      }
    }

    return {
      success: true,
      importedCount: results.length,
      transactions: results,
    };
  }

  /**
   * Escanear bandeja de entrada de Gmail mediante IMAP seguro (App Password)
   */
  static async scanGmailInbox(
    userId: string,
    options?: {
      userEmail?: string;
      appPassword?: string;
      daysBack?: number;
      scanLimit?: number;
      startDate?: string;
      endDate?: string;
    }
  ) {
    const userEmail = options?.userEmail || process.env.GMAIL_USER;
    const appPassword = (options?.appPassword || process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');

    if (!userEmail || !appPassword) {
      return {
        success: false,
        error: 'CREDENTIALS_REQUIRED',
        message: 'Debes ingresar tu correo de Gmail y la Contraseña de Aplicación de 16 caracteres.',
        transactions: [],
      };
    }

    // Persistir GMAIL_USER si se proporcionó uno nuevo
    if (options?.userEmail && options.userEmail !== process.env.GMAIL_USER) {
      process.env.GMAIL_USER = options.userEmail;
      try {
        const rootEnvPath = path.resolve(process.cwd(), '../../.env');
        const localEnvPath = path.resolve(process.cwd(), '.env');
        const targetPath = fs.existsSync(rootEnvPath) ? rootEnvPath : (fs.existsSync(localEnvPath) ? localEnvPath : null);
        if (targetPath) {
          let envContent = fs.readFileSync(targetPath, 'utf-8');
          if (envContent.includes('GMAIL_USER=')) {
            envContent = envContent.replace(/GMAIL_USER=.*/, `GMAIL_USER=${options.userEmail}`);
          } else {
            envContent += `\nGMAIL_USER=${options.userEmail}`;
          }
          fs.writeFileSync(targetPath, envContent, 'utf-8');
        }
      } catch (err) {
        console.warn('No se pudo guardar GMAIL_USER en .env:', err);
      }
    }

    const client = new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: {
        user: userEmail,
        pass: appPassword,
      },
      logger: false,
    });

    const messages: ParsedBankAlert[] = [];

    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');

      try {
        let sinceDate: Date;
        let beforeDate: Date | undefined;

        if (options?.startDate) {
          sinceDate = new Date(`${options.startDate}T00:00:00`);
        } else {
          const scanDays = options?.daysBack || 45;
          sinceDate = new Date();
          sinceDate.setDate(sinceDate.getDate() - scanDays);
        }

        if (options?.endDate) {
          beforeDate = new Date(`${options.endDate}T00:00:00`);
          beforeDate.setDate(beforeDate.getDate() + 1); // IMAP before es exclusivo
        }

        const scanLimit = options?.scanLimit || 150;

        const searchQuery: any = { since: sinceDate };
        if (beforeDate) {
          searchQuery.before = beforeDate;
        }

        // Buscar mensajes recientes
        let seqNumbers: number[] = [];
        try {
          const searchResult = await client.search(searchQuery);
          if (Array.isArray(searchResult)) {
            seqNumbers = searchResult;
          }
        } catch (searchErr) {
          console.warn('Búsqueda por fecha falló, usando mensajes recientes:', searchErr);
        }

        // Si no arrojó resultados por fecha, tomar los últimos mensajes disponibles
        if (seqNumbers.length === 0 && client.mailbox && client.mailbox.exists > 0) {
          const total = client.mailbox.exists;
          const start = Math.max(1, total - scanLimit);
          for (let i = start; i <= total; i++) {
            seqNumbers.push(i);
          }
        }

        // Inspeccionar hasta `scanLimit` mensajes
        const seqToInspect = seqNumbers.slice(-scanLimit);

        if (seqToInspect.length > 0) {
          // ETAPA 1: Fetch ultra-rápido solo de sobres (headers) para filtrar sin descargar cuerpos pesados
          const relevantSeqs: number[] = [];
          const envelopeMap = new Map<number, any>();

          for await (const msg of client.fetch(seqToInspect, { envelope: true })) {
            const from = (
              msg.envelope?.from?.[0]?.address ||
              msg.envelope?.from?.[0]?.name ||
              ''
            ).toLowerCase();
            const subject = (msg.envelope?.subject || '').toLowerCase();

            const isExcluded =
              subject.includes('código de verificación') ||
              subject.includes('codigo de verificacion') ||
              subject.includes('código de seguridad') ||
              subject.includes('codigo de seguridad') ||
              subject.includes('tu código') ||
              subject.includes('tu codigo') ||
              subject.includes('verification code') ||
              subject.includes('security code') ||
              subject.includes('inicio de sesión') ||
              subject.includes('inicio de sesion') ||
              subject.includes('nuevo inicio') ||
              subject.includes('restablecer') ||
              subject.includes('password reset') ||
              subject.includes('términos y condiciones') ||
              subject.includes('politica de privacidad') ||
              subject.includes('política de privacidad') ||
              subject.includes('alerta de seguridad') ||
              subject.includes('seguridad de tu cuenta');

            const isBankOrMobilitySender =
              from.includes('banreservas') ||
              from.includes('bpd.com.do') ||
              from.includes('popular.com.do') ||
              from.includes('bancopopular') ||
              from.includes('bhd') ||
              from.includes('qik') ||
              from.includes('scotiabank') ||
              from.includes('apap') ||
              from.includes('promerica') ||
              from.includes('santacruz') ||
              from.includes('alnap') ||
              from.includes('uber.com') ||
              from.includes('uberrd');

            const isFinancialSubject =
              subject.includes('consumo') ||
              subject.includes('transacción') ||
              subject.includes('transaccion') ||
              subject.includes('aviso de débito') ||
              subject.includes('aviso de debito') ||
              subject.includes('aviso de crédito') ||
              subject.includes('aviso de credito') ||
              subject.includes('recibo de uber') ||
              subject.includes('tu viaje con uber') ||
              subject.includes('nómina') ||
              subject.includes('nomina') ||
              subject.includes('sueldo') ||
              subject.includes('salario') ||
              subject.includes('quincena') ||
              subject.includes('transferencia recibida') ||
              subject.includes('transferencia enviada') ||
              subject.includes('depósito recibido') ||
              subject.includes('deposito recibido') ||
              subject.includes('pago de tarjeta');

            const isRelevantHeader = !isExcluded && (isBankOrMobilitySender || isFinancialSubject);

            if (isRelevantHeader) {
              relevantSeqs.push(msg.seq);
              envelopeMap.set(msg.seq, msg.envelope);
            }
          }

          // ETAPA 2: Descargar cuerpo completo únicamente de los mensajes relevantes
          if (relevantSeqs.length > 0) {
            for await (const msg of client.fetch(relevantSeqs, { source: true, envelope: true })) {
              if (!msg.source) continue;
              try {
                const parsedMail = await simpleParser(msg.source);
                const subject = parsedMail.subject || msg.envelope?.subject || '';
                const textContent = (parsedMail.text || parsedMail.html || '').toString();
                const mailDate = parsedMail.date ? new Date(parsedMail.date) : (msg.envelope?.date ? new Date(msg.envelope.date) : new Date());
                const sender = msg.envelope?.from?.[0]?.address || msg.envelope?.from?.[0]?.name || parsedMail.from?.text || '';

                if (textContent || subject) {
                  const alert = this.parseEmailText(textContent, subject, mailDate, sender);

                  // Filtrar con máxima precisión: debe tener monto positivo y banco/movilidad/nómina reconocido
                  const hasRecognizedEntity = 
                    alert.bank !== 'Banco Dominicano (Desconocido)' || 
                    alert.isTransport || 
                    alert.isPayroll || 
                    Boolean(alert.accountNumber) ||
                    Boolean(alert.cardLast4);

                  const isAfterSince = alert.date >= sinceDate;
                  const isBeforeEnd = !options?.endDate || alert.date <= new Date(`${options.endDate}T23:59:59`);

                  if (isAfterSince && isBeforeEnd && alert.amount > 0 && hasRecognizedEntity) {
                    const exists = messages.some(
                      (m) =>
                        m.amount === alert.amount &&
                        m.bank === alert.bank &&
                        m.merchant === alert.merchant &&
                        Math.abs(new Date(m.date).getTime() - new Date(alert.date).getTime()) < 60000
                    );
                    if (!exists) {
                      messages.push(alert);
                    }
                  }
                }
              } catch (mailErr) {
                console.error('Error parseando correo individual:', mailErr);
              }
            }
          }
        }

        // Ordenar por fecha descendente (más recientes primero)
        messages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      } finally {
        lock.release();
        await client.logout();
      }

      // Enriquecer con cuentas registradas del usuario para auto-identificar 9608253361 y 9609387654
      const enrichedMessages = await this.enrichWithUserAccounts(messages, userId);

      return {
        success: true,
        scannedCount: enrichedMessages.length,
        userEmail,
        transactions: enrichedMessages,
      };
    } catch (err: any) {
      console.error('Error en conexión IMAP Gmail:', err);
      return {
        success: false,
        error: 'AUTH_FAILED',
        message: err.message?.includes('AUTHENTICATIONFAILED')
          ? 'Error de autenticación con Gmail. Verifica tu correo y que la Contraseña de Aplicación de 16 caracteres sea correcta.'
          : `No se pudo conectar al servidor IMAP de Gmail: ${err.message}`,
        transactions: [],
      };
    }
  }

  /**
   * Obtener configuración de sincronización de Gmail
   */
  static async getGmailSyncConfig(userId: string) {
    const rawAppPassword = process.env.GMAIL_APP_PASSWORD || '';
    const cleanAppPassword = rawAppPassword.replace(/\s+/g, '');
    const userEmail = process.env.GMAIL_USER || 'peliezer51@gmail.com';
    const hasConfig = Boolean(cleanAppPassword.length >= 16);

    return {
      isConnected: hasConfig,
      userEmail,
      hasAppPassword: Boolean(cleanAppPassword),
      lastScanAt: null,
      supportedBanks: [
        { name: 'Uber Technologies (Recibos de Viajes)', domains: ['@uber.com'] },
        { name: 'Banco Popular Dominicano', domains: ['@bpd.com.do', '@alertas.bpd.com.do'] },
        { name: 'Banreservas', domains: ['@banreservas.com.do'] },
        { name: 'Banco BHD', domains: ['@bhd.com.do', '@alertas.bhd.com.do'] },
        { name: 'Qik Banco Digital', domains: ['@qik.com.do'] },
        { name: 'Scotiabank RD', domains: ['@scotiabank.com'] },
      ],
    };
  }

  /**
   * Escanear Gmail para detectar cuentas registradas/iniciadas y suscripciones recurrentes
   */
  static async scanAccountsAndSubscriptions(
    userId: string,
    options?: {
      userEmail?: string;
      appPassword?: string;
      daysBack?: number;
      scanLimit?: number;
    }
  ) {
    const userEmail = options?.userEmail || process.env.GMAIL_USER || 'peliezer51@gmail.com';
    const appPassword = (options?.appPassword || process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');

    if (!userEmail || !appPassword) {
      return {
        success: false,
        error: 'CREDENTIALS_REQUIRED',
        message: 'Se requiere el correo peliezer51@gmail.com y su Contraseña de Aplicación de 16 caracteres.',
        accounts: [],
        subscriptions: [],
      };
    }

    const KNOWN_SERVICES: Record<
      string,
      {
        name: string;
        category: string;
        websiteUrl: string;
        isSubscriptionCandidate?: boolean;
        defaultPrice?: number;
        defaultCurrency?: Currency;
      }
    > = {
      'github.com': { name: 'GitHub', category: 'DEVELOPMENT', websiteUrl: 'https://github.com' },
      'gitlab.com': { name: 'GitLab', category: 'DEVELOPMENT', websiteUrl: 'https://gitlab.com' },
      'notion.so': { name: 'Notion', category: 'WORK', websiteUrl: 'https://notion.so' },
      'canva.com': { name: 'Canva', category: 'WORK', websiteUrl: 'https://canva.com', isSubscriptionCandidate: true, defaultPrice: 12.99, defaultCurrency: Currency.USD },
      'openai.com': { name: 'ChatGPT / OpenAI', category: 'WORK', websiteUrl: 'https://chatgpt.com', isSubscriptionCandidate: true, defaultPrice: 20, defaultCurrency: Currency.USD },
      'figma.com': { name: 'Figma', category: 'WORK', websiteUrl: 'https://figma.com' },
      'slack.com': { name: 'Slack', category: 'WORK', websiteUrl: 'https://slack.com' },
      'spotify.com': { name: 'Spotify', category: 'STREAMING', websiteUrl: 'https://spotify.com', isSubscriptionCandidate: true, defaultPrice: 5.99, defaultCurrency: Currency.USD },
      'netflix.com': { name: 'Netflix', category: 'STREAMING', websiteUrl: 'https://netflix.com', isSubscriptionCandidate: true, defaultPrice: 6.99, defaultCurrency: Currency.USD },
      'youtube.com': { name: 'YouTube Premium', category: 'STREAMING', websiteUrl: 'https://youtube.com', isSubscriptionCandidate: true, defaultPrice: 13.99, defaultCurrency: Currency.USD },
      'apple.com': { name: 'Apple / iCloud', category: 'GENERAL', websiteUrl: 'https://apple.com', isSubscriptionCandidate: true, defaultPrice: 2.99, defaultCurrency: Currency.USD },
      'google.com': { name: 'Google Play / Google One', category: 'GENERAL', websiteUrl: 'https://play.google.com', isSubscriptionCandidate: true, defaultPrice: 2.99, defaultCurrency: Currency.USD },
      'amazon.com': { name: 'Amazon Prime', category: 'STREAMING', websiteUrl: 'https://amazon.com', isSubscriptionCandidate: true, defaultPrice: 8.99, defaultCurrency: Currency.USD },
      'disneyplus.com': { name: 'Disney+', category: 'STREAMING', websiteUrl: 'https://disneyplus.com', isSubscriptionCandidate: true, defaultPrice: 7.99, defaultCurrency: Currency.USD },
      'hbomax.com': { name: 'Max (HBO)', category: 'STREAMING', websiteUrl: 'https://max.com', isSubscriptionCandidate: true, defaultPrice: 9.99, defaultCurrency: Currency.USD },
      'max.com': { name: 'Max (HBO)', category: 'STREAMING', websiteUrl: 'https://max.com', isSubscriptionCandidate: true, defaultPrice: 9.99, defaultCurrency: Currency.USD },
      'crunchyroll.com': { name: 'Crunchyroll', category: 'STREAMING', websiteUrl: 'https://crunchyroll.com', isSubscriptionCandidate: true, defaultPrice: 7.99, defaultCurrency: Currency.USD },
      'discord.com': { name: 'Discord', category: 'SOCIAL', websiteUrl: 'https://discord.com', isSubscriptionCandidate: true, defaultPrice: 9.99, defaultCurrency: Currency.USD },
      'linkedin.com': { name: 'LinkedIn', category: 'WORK', websiteUrl: 'https://linkedin.com' },
      'twitter.com': { name: 'X (Twitter)', category: 'SOCIAL', websiteUrl: 'https://x.com' },
      'x.com': { name: 'X (Twitter)', category: 'SOCIAL', websiteUrl: 'https://x.com' },
      'instagram.com': { name: 'Instagram', category: 'SOCIAL', websiteUrl: 'https://instagram.com' },
      'facebookmail.com': { name: 'Facebook', category: 'SOCIAL', websiteUrl: 'https://facebook.com' },
      'steampowered.com': { name: 'Steam Games', category: 'GAMING', websiteUrl: 'https://store.steampowered.com' },
      'steamcommunity.com': { name: 'Steam Games', category: 'GAMING', websiteUrl: 'https://store.steampowered.com' },
      'epicgames.com': { name: 'Epic Games', category: 'GAMING', websiteUrl: 'https://epicgames.com' },
      'playstation.com': { name: 'PlayStation Network', category: 'GAMING', websiteUrl: 'https://playstation.com', isSubscriptionCandidate: true, defaultPrice: 9.99, defaultCurrency: Currency.USD },
      'duolingo.com': { name: 'Duolingo', category: 'GENERAL', websiteUrl: 'https://duolingo.com', isSubscriptionCandidate: true, defaultPrice: 6.99, defaultCurrency: Currency.USD },
      'digitalocean.com': { name: 'DigitalOcean', category: 'DEVELOPMENT', websiteUrl: 'https://digitalocean.com', isSubscriptionCandidate: true, defaultPrice: 12.00, defaultCurrency: Currency.USD },
      'vultr.com': { name: 'Vultr Cloud', category: 'DEVELOPMENT', websiteUrl: 'https://vultr.com', isSubscriptionCandidate: true, defaultPrice: 10.00, defaultCurrency: Currency.USD },
      'vercel.com': { name: 'Vercel', category: 'DEVELOPMENT', websiteUrl: 'https://vercel.com' },
      'smartfit.com.do': { name: 'Gimnasio Smart Fit', category: 'HEALTH', websiteUrl: 'https://smartfit.com.do', isSubscriptionCandidate: true, defaultPrice: 1790, defaultCurrency: Currency.DOP },
      'patreon.com': { name: 'Patreon', category: 'STREAMING', websiteUrl: 'https://patreon.com', isSubscriptionCandidate: true, defaultPrice: 5.00, defaultCurrency: Currency.USD },
      'codecademy.com': { name: 'Codecademy', category: 'EDUCATION', websiteUrl: 'https://codecademy.com', isSubscriptionCandidate: true, defaultPrice: 17.49, defaultCurrency: Currency.USD },
      'codigofacilito.com': { name: 'Código Facilito', category: 'EDUCATION', websiteUrl: 'https://codigofacilito.com', isSubscriptionCandidate: true, defaultPrice: 9.99, defaultCurrency: Currency.USD },
      'udemy.com': { name: 'Udemy', category: 'EDUCATION', websiteUrl: 'https://udemy.com' },
      'udemymail.com': { name: 'Udemy', category: 'EDUCATION', websiteUrl: 'https://udemy.com' },
      'supabase.com': { name: 'Supabase', category: 'DEVELOPMENT', websiteUrl: 'https://supabase.com' },
      'upwork.com': { name: 'Upwork', category: 'WORK', websiteUrl: 'https://upwork.com' },
      'fiverr.com': { name: 'Fiverr', category: 'WORK', websiteUrl: 'https://fiverr.com' },
      'joppy.me': { name: 'Joppy', category: 'WORK', websiteUrl: 'https://joppy.me' },
      'pedidosya.com': { name: 'PedidosYa / PedidosYa Plus', category: 'FOOD', websiteUrl: 'https://pedidosya.com.do', isSubscriptionCandidate: true, defaultPrice: 199, defaultCurrency: Currency.DOP },
      'uber.com': { name: 'Uber Technologies', category: 'GENERAL', websiteUrl: 'https://uber.com' },
      'didiglobal.com': { name: 'DiDi', category: 'GENERAL', websiteUrl: 'https://didi-global.com' },
      'mcafee.com': { name: 'McAfee Antivirus', category: 'GENERAL', websiteUrl: 'https://mcafee.com', isSubscriptionCandidate: true, defaultPrice: 39.99, defaultCurrency: Currency.USD },
      'shopify.com': { name: 'Shopify', category: 'GENERAL', websiteUrl: 'https://shopify.com', isSubscriptionCandidate: true, defaultPrice: 29.00, defaultCurrency: Currency.USD },
      'jetbrains.com': { name: 'JetBrains', category: 'DEVELOPMENT', websiteUrl: 'https://jetbrains.com', isSubscriptionCandidate: true, defaultPrice: 9.99, defaultCurrency: Currency.USD },
      'hunter.io': { name: 'Hunter.io', category: 'WORK', websiteUrl: 'https://hunter.io' },
      'dribbble.com': { name: 'Dribbble', category: 'WORK', websiteUrl: 'https://dribbble.com' },
      'pullbear.com': { name: 'Pull&Bear', category: 'GENERAL', websiteUrl: 'https://pullbear.com' },
      'zara.com': { name: 'Zara', category: 'GENERAL', websiteUrl: 'https://zara.com' },
      'sheerid.com': { name: 'SheerID Verification', category: 'EDUCATION', websiteUrl: 'https://sheerid.com' },
      'holistics.io': { name: 'dbdiagram.io', category: 'DEVELOPMENT', websiteUrl: 'https://dbdiagram.io' },
      'tecoloco.com': { name: 'Tecoloco', category: 'WORK', websiteUrl: 'https://tecoloco.com' },
      'codegym.cc': { name: 'CodeGym', category: 'EDUCATION', websiteUrl: 'https://codegym.cc', isSubscriptionCandidate: true, defaultPrice: 19.99, defaultCurrency: Currency.USD },
      'myunidays.com': { name: 'UNiDAYS', category: 'GENERAL', websiteUrl: 'https://myunidays.com' },
    };

    const client = new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: { user: userEmail, pass: appPassword },
      logger: false,
    });

    const detectedAccountsMap = new Map<string, any>();
    const detectedSubscriptionsMap = new Map<string, any>();

    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');

      try {
        const scanLimit = options?.scanLimit || 350;

        // Búsquedas dirigidas de alta precisión usando gmraw en Gmail
        const subQuery = 'category:purchases OR recibo OR factura OR invoice OR payment OR suscripcion OR subscription OR renovacion OR renewal OR "Google Play" OR Apple OR Netflix OR Spotify OR OpenAI OR ChatGPT OR Uber OR Patreon OR Stripe OR PayPal OR PedidosYa OR Steam OR PlayStation';
        const accQuery = 'bienvenido OR welcome OR "cuenta creada" OR "account created" OR "confirma tu" OR "confirm your" OR "verify" OR "verificación" OR "verificacion" OR "activar cuenta" OR "registro exitoso" OR "alerta de seguridad" OR "security alert"';

        let subSeqs: number[] = [];
        let accSeqs: number[] = [];

        try {
          const [subRes, accRes] = await Promise.all([
            client.search({ gmraw: subQuery }),
            client.search({ gmraw: accQuery }),
          ]);
          if (Array.isArray(subRes)) subSeqs = subRes;
          if (Array.isArray(accRes)) accSeqs = accRes;
        } catch (searchErr) {
          console.warn('Error en búsqueda gmraw, aplicando fallback:', searchErr);
        }

        // Combinar mensajes más recientes de ambas búsquedas
        const halfLimit = Math.ceil(scanLimit / 2);
        const combinedSeqs = Array.from(
          new Set([...subSeqs.slice(-halfLimit), ...accSeqs.slice(-halfLimit)])
        ).sort((a, b) => a - b);

        let seqToInspect = combinedSeqs;

        // Fallback a mensajes secuenciales si no se obtuvieron resultados
        if (seqToInspect.length === 0 && client.mailbox && client.mailbox.exists > 0) {
          const total = client.mailbox.exists;
          const start = Math.max(1, total - scanLimit);
          for (let i = start; i <= total; i++) seqToInspect.push(i);
        }

        if (seqToInspect.length > 0) {
          for await (const msg of client.fetch(seqToInspect, { source: true, envelope: true })) {
            if (!msg.source) continue;
            try {
              const parsedMail = await simpleParser(msg.source);
              const senderAddress = (msg.envelope?.from?.[0]?.address || parsedMail.from?.value?.[0]?.address || '').toLowerCase();
              const senderName = msg.envelope?.from?.[0]?.name || parsedMail.from?.value?.[0]?.name || '';
              const subject = (parsedMail.subject || msg.envelope?.subject || '').toString();
              const textContent = (parsedMail.text || parsedMail.html || '').toString();
              const mailDate = parsedMail.date ? new Date(parsedMail.date) : new Date();

              // 1. Detectar cobros de suscripciones y servicios web a través de alertas bancarias dominicanas
              const isBankNotification =
                senderAddress.includes('banreservas') ||
                senderAddress.includes('bpd') ||
                senderAddress.includes('bhd') ||
                senderAddress.includes('qik') ||
                senderAddress.includes('scotiabank') ||
                senderAddress.includes('promerica');

              if (isBankNotification) {
                const merchantMatch = textContent.match(/Comercio:\s*([^\r\n]+)/i);
                const amountMatch = textContent.match(/Monto:\s*(DOP|USD|\$|RD\$)?\s*([0-9,.]+)/i);

                if (merchantMatch && amountMatch) {
                  const rawMerchant = merchantMatch[1].trim();
                  const mUpper = rawMerchant.toUpperCase();
                  const isUsd = (amountMatch[1] || 'DOP').toUpperCase().includes('USD') || amountMatch[1] === '$';
                  const currency = isUsd ? Currency.USD : Currency.DOP;
                  const amount = parseFloat(amountMatch[2].replace(/,/g, ''));

                  let webServiceName = '';
                  let webCat = 'GENERAL';
                  let webUrl = '';

                  if (mUpper.includes('UBER')) {
                    webServiceName = 'Uber Technologies';
                    webCat = 'GENERAL';
                    webUrl = 'https://uber.com';
                  } else if (mUpper.includes('NETFLIX')) {
                    webServiceName = 'Netflix';
                    webCat = 'STREAMING';
                    webUrl = 'https://netflix.com';
                  } else if (mUpper.includes('SPOTIFY')) {
                    webServiceName = 'Spotify';
                    webCat = 'STREAMING';
                    webUrl = 'https://spotify.com';
                  } else if (mUpper.includes('OPENAI') || mUpper.includes('CHATGPT')) {
                    webServiceName = 'ChatGPT / OpenAI';
                    webCat = 'WORK';
                    webUrl = 'https://chatgpt.com';
                  } else if (mUpper.includes('GOOGLE') || mUpper.includes('PLAY')) {
                    webServiceName = 'Google Play / Google One';
                    webCat = 'GENERAL';
                    webUrl = 'https://play.google.com';
                  } else if (mUpper.includes('APPLE')) {
                    webServiceName = 'Apple / iCloud';
                    webCat = 'GENERAL';
                    webUrl = 'https://apple.com';
                  } else if (mUpper.includes('STEAM')) {
                    webServiceName = 'Steam Games';
                    webCat = 'GAMING';
                    webUrl = 'https://store.steampowered.com';
                  } else if (mUpper.includes('AMAZON') || mUpper.includes('PRIME')) {
                    webServiceName = 'Amazon Prime';
                    webCat = 'STREAMING';
                    webUrl = 'https://amazon.com';
                  } else if (mUpper.includes('PEDIDOSYA')) {
                    webServiceName = 'PedidosYa / PedidosYa Plus';
                    webCat = 'FOOD';
                    webUrl = 'https://pedidosya.com.do';
                  } else if (mUpper.includes('PATREON')) {
                    webServiceName = 'Patreon';
                    webCat = 'STREAMING';
                    webUrl = 'https://patreon.com';
                  } else if (mUpper.includes('ADOBE')) {
                    webServiceName = 'Adobe Creative Cloud';
                    webCat = 'WORK';
                    webUrl = 'https://adobe.com';
                  } else if (mUpper.includes('MICROSOFT')) {
                    webServiceName = 'Microsoft / Xbox';
                    webCat = 'WORK';
                    webUrl = 'https://microsoft.com';
                  }

                  if (webServiceName && amount > 0) {
                    const key = webServiceName.toLowerCase();
                    if (!detectedSubscriptionsMap.has(key)) {
                      detectedSubscriptionsMap.set(key, {
                        name: webServiceName,
                        domain: webUrl.replace('https://', ''),
                        category: webCat,
                        websiteUrl: webUrl,
                        estimatedAmount: amount,
                        currency,
                        billingCycle: 'MONTHLY',
                        detectedSubject: `Cobro en tarjeta: ${rawMerchant} (${currency} ${amount})`,
                        lastEmailDate: mailDate.toISOString(),
                        isVerifiedPayment: true,
                        evidence: `Cobro aprobado en tarjeta bancaria: "${rawMerchant}"`,
                      });
                    }

                    if (!detectedAccountsMap.has(key)) {
                      detectedAccountsMap.set(key, {
                        appName: webServiceName,
                        domain: webUrl.replace('https://', ''),
                        category: webCat,
                        websiteUrl: webUrl,
                        linkedEmail: userEmail,
                        detectedSubject: `Cobro en comercio web: ${rawMerchant}`,
                        detectedSender: senderAddress,
                        lastEmailDate: mailDate.toISOString(),
                      });
                    }
                  }
                }
                continue; // No continuar procesando como correo directo de app
              }

              // 2. Extraer dominio del remitente directo
              const domainMatch = senderAddress.match(/@([a-z0-9.-]+\.[a-z]{2,})/i);
              const fullDomain = domainMatch ? domainMatch[1].toLowerCase() : '';
              const baseDomain = fullDomain.replace(
                /^(?:mail\.|email\.|notifications\.|no-reply\.|noreply\.|alertas\.|notify\.|support\.|em\.|newsletters-noreply\.|jobs-noreply\.|jobalerts-noreply\.|marketing\.|e\.|announce\.)/i,
                ''
              );

              let appName = '';
              let category = 'GENERAL';
              let websiteUrl = baseDomain ? `https://${baseDomain}` : '';
              let isSubCandidate = false;
              let defaultPrice = 9.99;
              let defaultCurrency: Currency = Currency.USD;

              // Buscar en diccionario de servicios conocidos
              for (const [key, conf] of Object.entries(KNOWN_SERVICES)) {
                if (senderAddress.includes(key) || fullDomain.includes(key) || baseDomain.includes(key)) {
                  appName = conf.name;
                  category = conf.category;
                  websiteUrl = conf.websiteUrl;
                  isSubCandidate = Boolean(conf.isSubscriptionCandidate);
                  if (conf.defaultPrice) defaultPrice = conf.defaultPrice;
                  if (conf.defaultCurrency) defaultCurrency = conf.defaultCurrency;
                  break;
                }
              }

              // Fallback a nombre de remitente o nombre de dominio limpio
              if (!appName) {
                if (senderName && !senderName.includes('@') && senderName.length < 35) {
                  appName = senderName
                    .replace(/\s*(?:Team|Equipo|Newsletter|Updates|via LinkedIn|a través de LinkedIn|Instructor:.*)$/i, '')
                    .trim();
                } else if (baseDomain) {
                  const rawName = baseDomain.split('.')[0];
                  if (rawName && rawName.length > 2) {
                    appName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
                  }
                }
              }

              if (appName && appName.length >= 2) {
                const key = appName.toLowerCase();

                // Agregar a cuentas detectadas
                if (!detectedAccountsMap.has(key)) {
                  detectedAccountsMap.set(key, {
                    appName,
                    domain: baseDomain || fullDomain,
                    category,
                    websiteUrl,
                    linkedEmail: userEmail,
                    detectedSubject: subject.slice(0, 90),
                    detectedSender: senderAddress,
                    lastEmailDate: mailDate.toISOString(),
                  });
                }

                // Evaluar si es un correo de pago recurrente / recibo / suscripción
                const lowerSubject = subject.toLowerCase();
                const lowerCombined = `${subject}\n${textContent}`.toLowerCase();

                const isOfficialReceipt =
                  lowerSubject.includes('el recibo de tu pedido') ||
                  lowerSubject.includes('tu recibo de') ||
                  lowerSubject.includes('recibo de compra') ||
                  lowerSubject.includes('recibo de la transacción') ||
                  lowerSubject.includes('factura #') ||
                  lowerSubject.includes('invoice #') ||
                  lowerSubject.includes('comprobante de pago') ||
                  lowerSubject.includes('factura vta') ||
                  lowerCombined.includes('total pagado') ||
                  lowerCombined.includes('total cobrado') ||
                  lowerCombined.includes('order total:') ||
                  lowerCombined.includes('payment received') ||
                  lowerCombined.includes('pago confirmado') ||
                  lowerCombined.includes('billing receipt');

                const isGeneralSubMention =
                  isSubCandidate ||
                  lowerCombined.includes('suscrip') ||
                  lowerCombined.includes('subscrip') ||
                  lowerCombined.includes('factura') ||
                  lowerCombined.includes('invoice') ||
                  lowerCombined.includes('recibo') ||
                  lowerCombined.includes('receipt') ||
                  lowerCombined.includes('renovaci') ||
                  lowerCombined.includes('renewal') ||
                  lowerCombined.includes('membership') ||
                  lowerCombined.includes('membresi') ||
                  lowerCombined.includes('tu plan');

                if (isOfficialReceipt || isGeneralSubMention) {
                  let amount = defaultPrice;
                  let currency = defaultCurrency;

                  const priceMatch =
                    lowerCombined.match(/(?:us\$|usd|\$|rd\$|dop)\s*([0-9]+(?:\.[0-9]{2})?)/i) ||
                    lowerCombined.match(/([0-9]+(?:\.[0-9]{2})?)\s*(?:usd|dop|us\$)/i);

                  if (priceMatch) {
                    const parsed = parseFloat(priceMatch[1]);
                    if (parsed > 0 && parsed < 50000) {
                      amount = parsed;
                      if (
                        lowerCombined.includes('rd$') ||
                        lowerCombined.includes('dop') ||
                        lowerCombined.includes('pesos')
                      ) {
                        currency = Currency.DOP;
                      }
                    }
                  }

                  const isAnnual =
                    lowerCombined.includes('anual') ||
                    lowerCombined.includes('annual') ||
                    lowerCombined.includes('año') ||
                    lowerCombined.includes('year');

                  if (!detectedSubscriptionsMap.has(key)) {
                    detectedSubscriptionsMap.set(key, {
                      name: appName,
                      domain: baseDomain || fullDomain,
                      category,
                      websiteUrl,
                      estimatedAmount: amount,
                      currency,
                      billingCycle: isAnnual ? 'ANNUAL' : 'MONTHLY',
                      detectedSubject: subject.slice(0, 90),
                      lastEmailDate: mailDate.toISOString(),
                      isVerifiedPayment: isOfficialReceipt,
                      evidence: isOfficialReceipt
                        ? `Recibo/factura oficial emitido: "${subject.slice(0, 50)}"`
                        : `Mención de plan o servicio en correo: "${subject.slice(0, 50)}"`,
                    });
                  }
                }
              }
            } catch (parseErr) {
              console.warn('Error parseando correo individual:', parseErr);
            }
          }
        }
      } finally {
        lock.release();
        await client.logout();
      }

      // Comprobar cuáles ya están guardadas en la base de datos para no duplicar
      const existingAccounts = await prisma.appCredential.findMany({
        where: { userId },
        select: { appName: true },
      });
      const existingAccountNames = new Set(existingAccounts.map((a) => a.appName.toLowerCase().trim()));

      const existingSubs = await prisma.subscription.findMany({
        where: { userId },
        select: { name: true },
      });
      const existingSubNames = new Set(existingSubs.map((s) => s.name.toLowerCase().trim()));

      const accountsResult = Array.from(detectedAccountsMap.values()).map((acc) => ({
        ...acc,
        isAlreadySaved: existingAccountNames.has(acc.appName.toLowerCase().trim()),
      }));

      const subsResult = Array.from(detectedSubscriptionsMap.values()).map((sub) => ({
        ...sub,
        isAlreadySaved: existingSubNames.has(sub.name.toLowerCase().trim()),
      }));

      return {
        success: true,
        userEmail,
        accountsCount: accountsResult.length,
        subscriptionsCount: subsResult.length,
        accounts: accountsResult,
        subscriptions: subsResult,
      };
    } catch (err: any) {
      console.error('Error en escaneo de cuentas Gmail:', err);
      return {
        success: false,
        error: 'SCAN_FAILED',
        message: `Error al escanear Gmail: ${err.message}`,
        accounts: [],
        subscriptions: [],
      };
    }
  }

  /**
   * Importar cuentas detectadas directamente a AppCredential
   */
  static async importDetectedAccounts(
    userId: string,
    accounts: Array<{
      appName: string;
      linkedEmail: string;
      category?: string;
      websiteUrl?: string;
      notes?: string;
    }>
  ) {
    const results = [];
    for (const item of accounts) {
      if (!item.appName?.trim()) continue;
      const cleanAppName = item.appName.trim();
      const cleanEmail = (item.linkedEmail || 'peliezer51@gmail.com').trim().toLowerCase();

      const existing = await prisma.appCredential.findFirst({
        where: {
          userId,
          appName: { equals: cleanAppName, mode: 'insensitive' },
        },
      });

      if (!existing) {
        const created = await prisma.appCredential.create({
          data: {
            userId,
            appName: cleanAppName,
            linkedEmail: cleanEmail,
            password: '••••••••',
            websiteUrl: item.websiteUrl || null,
            category: item.category || 'GENERAL',
            notes: item.notes || `Detectado automáticamente desde Gmail (${cleanEmail})`,
          },
        });
        results.push(created);
      } else {
        const updated = await prisma.appCredential.update({
          where: { id: existing.id },
          data: {
            linkedEmail: cleanEmail,
            websiteUrl: item.websiteUrl || existing.websiteUrl,
            category: item.category || existing.category,
            notes: item.notes || existing.notes,
          },
        });
        results.push(updated);
      }
    }
    return { success: true, importedCount: results.length, items: results };
  }

  /**
   * Importar suscripciones detectadas directamente a Subscription
   */
  static async importDetectedSubscriptions(
    userId: string,
    subscriptions: Array<{
      name: string;
      amount: number;
      currency?: Currency;
      billingCycle?: string;
      tier?: string;
      websiteUrl?: string;
      notes?: string;
    }>
  ) {
    const results = [];
    for (const item of subscriptions) {
      if (!item.name?.trim()) continue;
      const cleanName = item.name.trim();
      const rawAmt = Number(item.amount);
      const safeAmount = isNaN(rawAmt) || rawAmt <= 0 ? 0 : rawAmt;
      const safeCurrency = item.currency === Currency.DOP ? Currency.DOP : Currency.USD;

      const existing = await prisma.subscription.findFirst({
        where: {
          userId,
          name: { equals: cleanName, mode: 'insensitive' },
        },
      });

      if (!existing) {
        const renewalDate = new Date();
        renewalDate.setDate(renewalDate.getDate() + 30);

        const created = await prisma.subscription.create({
          data: {
            userId,
            name: cleanName,
            amount: String(safeAmount),
            currency: safeCurrency,
            billingCycle: (item.billingCycle || 'MONTHLY') as any,
            tier: item.tier || 'Estándar',
            websiteUrl: item.websiteUrl || null,
            isActive: true,
            nextRenewalDate: renewalDate,
            notes: item.notes || 'Detectada automáticamente desde Gmail',
          },
        });
        results.push(created);
      } else {
        const updated = await prisma.subscription.update({
          where: { id: existing.id },
          data: {
            amount: safeAmount > 0 ? String(safeAmount) : existing.amount,
            currency: safeCurrency,
            billingCycle: (item.billingCycle || existing.billingCycle) as any,
            tier: item.tier || existing.tier,
            websiteUrl: item.websiteUrl || existing.websiteUrl,
            notes: item.notes || existing.notes,
          },
        });
        results.push(updated);
      }
    }
    return { success: true, importedCount: results.length, items: results };
  }
}

