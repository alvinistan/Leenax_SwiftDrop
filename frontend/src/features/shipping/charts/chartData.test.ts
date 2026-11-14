import { describe, expect, it } from 'vitest'
import { periodLabel } from './chartData'

describe('chart labels', () => {
  it('shows days and months in a short, readable form', () => {
    expect(periodLabel('2026-11-14')).toBe('14 Nov')
    expect(periodLabel('2026-11')).toBe('Nov 2026')
  })
})
