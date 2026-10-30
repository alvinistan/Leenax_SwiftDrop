import { describe, expect, it } from 'vitest'
import { formatMoney, formatUnitPrice, multiplyMoney } from './money'

describe('formatMoney', () => {
  it('formats Sri Lankan rupees with the currency code and two decimals', () => {
    expect(formatMoney({ amount: '2450', currency: 'LKR' })).toMatch(
      /^LKR\s2,450\.00$/,
    )
  })

  it('uses the currency of the value, not a fixed one', () => {
    expect(formatMoney({ amount: '19.5', currency: 'USD' })).toBe('$19.50')
  })

  it('adds "/ kg" to prices per kilogram', () => {
    expect(
      formatUnitPrice({ amount: '4200.00', currency: 'LKR' }, 'KG'),
    ).toMatch(/^LKR\s4,200\.00 \/ kg$/)
  })
})

describe('multiplyMoney', () => {
  it('multiplies exactly, without floating-point errors', () => {
    // With normal JavaScript numbers, 0.1 * 3 = 0.30000000000000004
    expect(multiplyMoney({ amount: '0.10', currency: 'LKR' }, '3').amount).toBe(
      '0.30',
    )
    expect(
      multiplyMoney({ amount: '4200.00', currency: 'LKR' }, '1.5').amount,
    ).toBe('6300.00')
  })

  it('rounds half up to cents', () => {
    // 3600.00 × 0.125 = 450.000; 99.99 × 0.005 = 0.49995 → 0.50
    expect(
      multiplyMoney({ amount: '3600.00', currency: 'LKR' }, '0.125').amount,
    ).toBe('450.00')
    expect(
      multiplyMoney({ amount: '99.99', currency: 'LKR' }, '0.005').amount,
    ).toBe('0.50')
  })
})
