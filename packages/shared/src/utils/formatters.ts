import { Decimal } from 'decimal.js';
import { Currency } from '../enums/index.js';

/**
 * Formatea montos para República Dominicana (RD$ o US$)
 */
export function formatMoney(
  amount: number | string | Decimal,
  currency: Currency = Currency.DOP,
  options?: { hideCents?: boolean }
): string {
  const num = typeof amount === 'number' 
    ? amount 
    : typeof amount === 'string' 
      ? parseFloat(amount) 
      : amount.toNumber();

  const formatted = new Intl.NumberFormat('es-DO', {
    minimumFractionDigits: options?.hideCents ? 0 : 2,
    maximumFractionDigits: options?.hideCents ? 0 : 2,
  }).format(num);

  if (currency === Currency.USD) {
    return `US$ ${formatted}`;
  }
  return `RD$ ${formatted}`;
}

/**
 * Normaliza un valor a Decimal para cálculos de precisión
 */
export function toDecimal(val: number | string | Decimal): Decimal {
  return new Decimal(val);
}

/**
 * Enmascara montos para modo privacidad (ej: "RD$ ••••••")
 */
export function maskMoney(currency: Currency = Currency.DOP): string {
  return currency === Currency.USD ? 'US$ ••••••' : 'RD$ ••••••';
}
