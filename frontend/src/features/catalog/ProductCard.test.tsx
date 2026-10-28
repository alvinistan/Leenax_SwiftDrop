import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Product } from '../../types/catalog'
import { ProductCard } from './ProductCard'

const product: Product = {
  id: 'test-1',
  name: 'Test Mug',
  slug: 'test-mug',
  category: { id: 'c1', name: 'Kitchen', slug: 'kitchen', imageUrl: null },
  price: { amount: '1450.00', currency: 'LKR' },
  imageUrl: null,
  inStock: true,
  isSample: true,
}

describe('ProductCard', () => {
  it('shows the name, formatted price and sample label', () => {
    render(<ProductCard product={product} onAddToCart={() => {}} />)

    expect(
      screen.getByRole('heading', { name: 'Test Mug' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/LKR\s1,450\.00/)).toBeInTheDocument()
    expect(screen.getByText('Sample')).toBeInTheDocument()
  })

  it('passes the product to onAddToCart when the button is clicked', async () => {
    const handleAdd = vi.fn()
    render(<ProductCard product={product} onAddToCart={handleAdd} />)

    await userEvent.click(
      screen.getByRole('button', { name: 'Add Test Mug to cart' }),
    )

    expect(handleAdd).toHaveBeenCalledWith(product)
  })

  it('cannot be added to the cart when out of stock', () => {
    render(
      <ProductCard
        product={{ ...product, inStock: false }}
        onAddToCart={() => {}}
      />,
    )

    expect(
      screen.getByRole('button', { name: 'Test Mug is out of stock' }),
    ).toBeDisabled()
  })
})
