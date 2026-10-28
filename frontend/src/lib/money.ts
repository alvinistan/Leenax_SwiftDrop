import type { Money } from '../types/catalog'

/** Formats money for display, e.g. { amount: '2450.00', currency: 'LKR' } → 'LKR 2,450.00'. */
export function formatMoney(money: Money, locale = 'en-LK'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: money.currency,
  }).format(Number(money.amount))
}
