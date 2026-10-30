import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { ProductSummary } from '../../types/catalog'
import { ProductGrid } from './ProductGrid'

const products: ProductSummary[] = [1, 2, 3].map((n) => ({
  id: `p${n}`,
  name: `Product ${n}`,
  slug: `product-${n}`,
  category: { id: 'c', name: 'Cat', slug: 'cat' },
  fromPrice: { amount: '100.00', currency: 'LKR' },
  fromPriceUnit: 'PIECE',
  status: 'ACTIVE',
}))

function renderGrid(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('ProductGrid', () => {
  it('shows a busy placeholder while loading', () => {
    renderGrid(<ProductGrid state={{ status: 'loading' }} onRetry={() => {}} />)

    expect(screen.getByLabelText('Loading products')).toHaveAttribute(
      'aria-busy',
      'true',
    )
  })

  it('shows an error with a working retry button', async () => {
    const handleRetry = vi.fn()
    renderGrid(
      <ProductGrid
        state={{ status: 'error', error: new Error('x') }}
        onRetry={handleRetry}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      "We couldn't load the products",
    )
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(handleRetry).toHaveBeenCalledOnce()
  })

  it('shows a helpful message when there are no products', () => {
    renderGrid(
      <ProductGrid
        state={{ status: 'success', data: [] }}
        onRetry={() => {}}
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'No products found' }),
    ).toBeInTheDocument()
  })

  it('shows one list item per product', () => {
    renderGrid(
      <ProductGrid
        state={{ status: 'success', data: products }}
        onRetry={() => {}}
      />,
    )

    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })
})
