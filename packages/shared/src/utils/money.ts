import { Decimal } from 'decimal.js';

/**
 * Convierte cualquier monto a centavos enteros para evitar errores IEEE-754 de punto flotante en JavaScript
 */
export function toCents(amount: number | string | Decimal): number {
  if (typeof amount === 'number') {
    return Math.round((amount + Number.EPSILON) * 100);
  }
  const dec = new Decimal(amount);
  return dec.times(100).round().toNumber();
}

/**
 * Convierte centavos enteros de vuelta a formato de moneda (2 decimales exactos)
 */
export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

/**
 * Suma dos cifras con precisión exacta de centavos
 */
export function addMoney(a: number | string, b: number | string): number {
  return fromCents(toCents(a) + toCents(b));
}

/**
 * Resta dos cifras con precisión exacta de centavos
 */
export function subtractMoney(a: number | string, b: number | string): number {
  return fromCents(toCents(a) - toCents(b));
}

/**
 * Multiplica un monto monetario por un factor (ej: tasa o porcentaje) con redondeo bancario exacto
 */
export function multiplyMoney(amount: number | string, factor: number | string): number {
  const dec = new Decimal(amount).times(new Decimal(factor));
  return dec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Suma una lista de importes sin perder centavos por acumulación de flotantes
 */
export function sumMoneyList(amounts: Array<number | string | Decimal>): number {
  const totalCents = amounts.reduce<number>((acc, cur) => acc + toCents(cur), 0);
  return fromCents(totalCents);
}

/**
 * Redondea un monto a 2 decimales bancarios exactos
 */
export function roundMoney(amount: number | string): number {
  return fromCents(toCents(amount));
}

/**
 * Auditoría Contable de Doble Partida:
 * Valida que la suma estricta de Débitos sea exactamente igual a la suma de Créditos (Diferencia = 0)
 */
export function verifyDoubleEntry(
  debits: Array<number | string>,
  credits: Array<number | string>
): { isBalanced: boolean; diff: number } {
  const totalDebitCents = debits.reduce<number>((acc, cur) => acc + toCents(cur), 0);
  const totalCreditCents = credits.reduce<number>((acc, cur) => acc + toCents(cur), 0);
  const diffCents = Math.abs(totalDebitCents - totalCreditCents);

  return {
    isBalanced: diffCents === 0,
    diff: fromCents(diffCents),
  };
}
