import { describe, expect, it } from 'vitest'
import { formatMoney } from './money'

describe('formatMoney', () => {
  it('formats Sri Lankan rupees with the currency code and two decimals', () => {
    expect(formatMoney({ amount: '2450', currency: 'LKR' })).toMatch(
      /^LKR\s2,450\.00$/,
    )
  })

  it('uses the currency of the value, not a fixed one', () => {
    expect(formatMoney({ amount: '19.5', currency: 'USD' })).toBe('$19.50')
  })
})
