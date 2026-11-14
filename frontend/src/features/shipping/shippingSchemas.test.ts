import { describe, expect, it } from 'vitest'
import {
  boxSchema,
  compareDecimals,
  markupSchema,
  rateCardSchema,
} from './shippingSchemas'

const rule = {
  name: 'Fee',
  type: 'PERCENT' as const,
  percent: '2',
  fixedAmount: '',
  minFee: '',
  maxFee: '',
  providerId: '',
  countryCode: '',
  effectiveFrom: '',
  effectiveTo: '',
  enabled: true,
  priority: '0',
}

describe('shipping form rules', () => {
  it('compares decimals exactly, without floating point', () => {
    expect(compareDecimals('0.3', '0.1')).toBe(1)
    expect(compareDecimals('2.000', '2')).toBe(0)
    expect(compareDecimals('1.999', '2')).toBe(-1)
    // Badly formatted input is not compared (and does not crash)
    expect(compareDecimals('abc', '2')).toBe(0)
  })

  it('does not crash on badly typed numbers', () => {
    const result = rateCardSchema.safeParse({
      serviceId: 's',
      countryCode: 'LK',
      enabled: true,
      bands: [
        { maxWeightKg: 'two', price: '5' },
        { maxWeightKg: '1', price: 'x' },
      ],
    })
    expect(result.success).toBe(false)
    expect(
      boxSchema
        .safeParse({
          name: 'Box',
          lengthCm: 'abc',
          widthCm: '0',
          heightCm: '1',
          emptyWeightKg: '0',
          maxWeightKg: '',
          enabled: true,
        })
        .error?.issues.map((i) => i.message),
    ).toEqual([
      'Length: enter centimetres, e.g. 30 or 12.5.',
      'Width must be more than 0.',
    ])
  })

  it('checks the platform fee values', () => {
    expect(markupSchema.safeParse(rule).success).toBe(true)
    expect(
      markupSchema.safeParse({ ...rule, percent: '100.5' }).error?.issues[0]
        .message,
    ).toBe('Percent cannot be more than 100.')
    expect(
      markupSchema.safeParse({ ...rule, minFee: '500', maxFee: '100' }).error
        ?.issues[0].message,
    ).toBe('The maximum must not be less than the minimum.')
    expect(
      markupSchema.safeParse({ ...rule, type: 'COMBINED' }).error?.issues[0]
        .message,
    ).toBe('Enter the fixed amount.')
  })
})
