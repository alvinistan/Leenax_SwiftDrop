import { describe, expect, it } from 'vitest'
import { newVariant, productSchema } from './productSchema'

const base = {
  categoryId: 'cat-1',
  name: 'Chocolate Cake',
  slug: 'chocolate-cake',
  description: '',
  status: 'ACTIVE' as const,
  variants: [{ ...newVariant(), sku: 'CAKE-1', price: '1200' }],
}

function messages(value: unknown) {
  const result = productSchema.safeParse(value)
  return result.success
    ? []
    : result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
}

describe('productSchema', () => {
  it('accepts a valid product, including a variant sold by weight', () => {
    expect(
      messages({
        ...base,
        variants: [
          ...base.variants,
          {
            ...newVariant('KG'),
            sku: 'CAKE-KG',
            price: '4200.50',
            maxQuantity: '5',
            stockQuantity: '3.25',
          },
        ],
      }),
    ).toEqual([])
  })

  it('rejects half pieces, a maximum below the minimum and duplicate SKUs', () => {
    expect(
      messages({
        ...base,
        variants: [
          {
            ...newVariant(),
            sku: 'CAKE-1',
            price: '1200',
            stockQuantity: '2.5',
            maxQuantity: '0',
          },
          { ...newVariant(), sku: 'cake-1', price: '12.345' },
        ],
      }),
    ).toEqual([
      'variants.0.maxQuantity: Maximum cannot be below the minimum.',
      'variants.0.stockQuantity: Pieces cannot be split: use a whole number.',
      'variants.1.price: Enter a price like 1250 or 1250.50.',
      'variants.1.sku: This SKU is already used above.',
    ])
  })

  it('does not allow an active product without an active variant', () => {
    expect(
      messages({ ...base, variants: [{ ...base.variants[0], active: false }] }),
    ).toEqual(['status: An active product needs at least one active variant.'])
  })
})
