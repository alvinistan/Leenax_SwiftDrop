import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import type { ProductSummary } from '../../types/catalog'
import { ProductCard } from './ProductCard'

const product: ProductSummary = {
  id: 'test-1',
  name: 'Chocolate Cake',
  slug: 'chocolate-cake',
  category: { id: 'c1', name: 'Cakes', slug: 'cakes' },
  fromPrice: { amount: '4200.00', currency: 'LKR' },
  fromPriceUnit: 'KG',
  status: 'ACTIVE',
}

describe('ProductCard', () => {
  it('links to the product page and shows the price per unit', () => {
    // Link needs a router around it; MemoryRouter is a router for tests.
    render(
      <MemoryRouter>
        <ProductCard product={product} />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('link', { name: 'Chocolate Cake' }),
    ).toHaveAttribute('href', '/products/chocolate-cake')
    expect(screen.getByText(/LKR\s4,200\.00 \/ kg/)).toBeInTheDocument()
  })

  it('shows the Sample badge only when asked', () => {
    const { rerender } = render(
      <MemoryRouter>
        <ProductCard product={product} />
      </MemoryRouter>,
    )
    expect(screen.queryByText('Sample')).not.toBeInTheDocument()

    rerender(
      <MemoryRouter>
        <ProductCard product={product} showSampleBadge />
      </MemoryRouter>,
    )
    expect(screen.getByText('Sample')).toBeInTheDocument()
  })
})
