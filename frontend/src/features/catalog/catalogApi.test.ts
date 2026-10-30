import { describe, expect, it } from 'vitest'
import { NotFoundError } from '../../lib/errors'
import { getProduct, listProducts } from './catalogApi'

describe('sample catalog API', () => {
  it('filters by category and reports the lowest price and its unit', async () => {
    const page = await listProducts({ categorySlug: 'cakes-bakery' })

    expect(page.content.map((p) => p.slug)).toEqual([
      'chocolate-cake',
      'butter-cake',
    ])
    expect(page.content[0].fromPrice?.amount).toBe('1200.00')
    expect(page.content[0].fromPriceUnit).toBe('PIECE')
  })

  it('splits results into pages', async () => {
    const first = await listProducts({ size: 5 })
    const last = await listProducts({ size: 5, page: 2 })

    expect(first.totalElements).toBe(12)
    expect(first.totalPages).toBe(3)
    expect(last.content).toHaveLength(2)
  })

  it('sorts by name', async () => {
    const page = await listProducts({ sort: 'name', size: 3 })

    expect(page.content.map((p) => p.name)).toEqual([
      'Bamboo Cutting Board',
      'Basmati Rice',
      'Building Blocks Set',
    ])
  })

  it('rejects unknown products with NotFoundError', async () => {
    await expect(getProduct('does-not-exist')).rejects.toBeInstanceOf(
      NotFoundError,
    )
  })
})
