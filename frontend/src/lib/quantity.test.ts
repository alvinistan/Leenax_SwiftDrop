import { describe, expect, it } from 'vitest'
import { canStep, formatQuantity, stepQuantity } from './quantity'

const cakeByWeight = { min: '0.5', max: '5', step: '0.5' }
const pieces = { min: '1', max: null, step: '1' }

describe('stepQuantity', () => {
  it('moves by one step within the limits', () => {
    expect(stepQuantity('0.5', cakeByWeight, 1)).toBe('1')
    expect(stepQuantity('1', cakeByWeight, 1)).toBe('1.5')
    expect(stepQuantity('1.5', cakeByWeight, -1)).toBe('1')
  })

  it('never goes below the minimum or above the maximum', () => {
    expect(stepQuantity('0.5', cakeByWeight, -1)).toBe('0.5')
    expect(stepQuantity('5', cakeByWeight, 1)).toBe('5')
    expect(canStep('5', cakeByWeight, 1)).toBe(false)
    expect(canStep('0.5', cakeByWeight, -1)).toBe(false)
  })

  it('has no upper limit when max is null', () => {
    expect(stepQuantity('99', pieces, 1)).toBe('100')
  })

  it('handles small steps exactly', () => {
    // 0.1 + 0.2 would be 0.30000000000000004 with normal numbers
    expect(stepQuantity('0.1', { min: '0.1', max: null, step: '0.2' }, 1)).toBe(
      '0.3',
    )
  })
})

describe('formatQuantity', () => {
  it('shows kg for weights and plain numbers for pieces', () => {
    expect(formatQuantity('1.500', 'KG')).toBe('1.5 kg')
    expect(formatQuantity('2', 'PIECE')).toBe('2')
  })
})
