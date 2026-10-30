import type { Money, SaleUnit } from '../types/catalog'
import { fromScaled, toScaled } from './decimal'

/** Formats money for display, e.g. { amount: '2450.00', currency: 'LKR' } → 'LKR 2,450.00'. */
export function formatMoney(money: Money, locale = 'en-LK'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: money.currency,
  }).format(Number(money.amount))
}

/** 'LKR 4,200.00 / kg' for KG prices; just the price for PIECE. */
export function formatUnitPrice(money: Money, unit: SaleUnit): string {
  return unit === 'KG' ? `${formatMoney(money)} / kg` : formatMoney(money)
}

/**
 * price × quantity, exactly, rounded half-up to 2 decimal places.
 * DISPLAY ONLY ("estimated total"): the server always calculates the real total.
 */
export function multiplyMoney(price: Money, quantity: string): Money {
  const priceCents = toScaled(price.amount, 2) // 2 decimals
  const quantityMilli = toScaled(quantity, 3) // 3 decimals
  const product = priceCents * quantityMilli // 5 decimals
  const rounded = (product + 500n) / 1000n // back to 2 decimals
  return { amount: fromScaled(rounded, 2), currency: price.currency }
}
