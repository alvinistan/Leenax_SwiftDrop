import { describe, expect, it } from 'vitest'
import { slugify } from './slugify'

describe('slugify', () => {
  it('makes URL-friendly slugs that the backend accepts', () => {
    expect(slugify('Cakes & Bakery')).toBe('cakes-bakery')
    expect(slugify('  Crème Brûlée!! ')).toBe('creme-brulee')
    expect(slugify('Kids---Toys')).toBe('kids-toys')
    expect(slugify('2 kg Rice')).toBe('2-kg-rice')
  })
})
