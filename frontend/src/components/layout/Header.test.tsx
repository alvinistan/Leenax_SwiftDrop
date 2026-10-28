import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Header } from './Header'

describe('Header', () => {
  it('announces the number of cart items', () => {
    render(<Header cartCount={3} />)

    expect(
      screen.getByRole('link', { name: 'Cart, 3 items' }),
    ).toBeInTheDocument()
  })

  it('opens and closes the mobile menu', async () => {
    render(<Header cartCount={0} />)
    const toggle = screen.getByRole('button', { name: 'Open menu' })

    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(
      screen.queryByRole('navigation', { name: 'Mobile' }),
    ).not.toBeInTheDocument()

    await userEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(
      screen.getByRole('navigation', { name: 'Mobile' }),
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Close menu' }))

    expect(
      screen.queryByRole('navigation', { name: 'Mobile' }),
    ).not.toBeInTheDocument()
  })
})
