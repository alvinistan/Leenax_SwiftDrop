import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('shows the main heading and labels the products as samples', () => {
    render(<App />)

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(screen.getByText(/not for sale/)).toBeInTheDocument()
  })

  it('updates the cart count in the header when a product is added', async () => {
    render(<App />)

    // findBy… waits for the sample products to finish "loading".
    const addButton = await screen.findByRole('button', {
      name: 'Add Ceramic Coffee Mug to cart',
    })
    await userEvent.click(addButton)

    expect(
      screen.getByRole('link', { name: 'Cart, 1 item' }),
    ).toBeInTheDocument()
  })
})
