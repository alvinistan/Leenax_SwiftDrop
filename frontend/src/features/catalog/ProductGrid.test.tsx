import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ProductGrid } from './ProductGrid'
import { sampleProducts } from './sampleData'

const noop = () => {}

describe('ProductGrid', () => {
  it('shows a busy placeholder while loading', () => {
    render(
      <ProductGrid
        status="loading"
        products={[]}
        onRetry={noop}
        onAddToCart={noop}
      />,
    )

    expect(screen.getByLabelText('Loading products')).toHaveAttribute(
      'aria-busy',
      'true',
    )
  })

  it('shows an error with a working retry button', async () => {
    const handleRetry = vi.fn()
    render(
      <ProductGrid
        status="error"
        products={[]}
        onRetry={handleRetry}
        onAddToCart={noop}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      "We couldn't load the products",
    )
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(handleRetry).toHaveBeenCalledOnce()
  })

  it('shows a helpful message when there are no products', () => {
    render(
      <ProductGrid
        status="success"
        products={[]}
        onRetry={noop}
        onAddToCart={noop}
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'No products yet' }),
    ).toBeInTheDocument()
  })

  it('shows one list item per product', () => {
    render(
      <ProductGrid
        status="success"
        products={sampleProducts}
        onRetry={noop}
        onAddToCart={noop}
      />,
    )

    expect(screen.getAllByRole('listitem')).toHaveLength(sampleProducts.length)
  })
})
