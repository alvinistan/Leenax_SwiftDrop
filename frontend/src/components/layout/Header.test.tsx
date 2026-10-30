import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { Header } from './Header'

// Links need a router around them; MemoryRouter is a router for tests.
function renderHeader(cartCount: number, path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Header cartCount={cartCount} />
    </MemoryRouter>,
  )
}

describe('Header', () => {
  it('announces the number of cart items', () => {
    renderHeader(3)

    expect(
      screen.getByRole('link', { name: 'Cart, 3 items' }),
    ).toBeInTheDocument()
  })

  it('marks the current page in the navigation', () => {
    renderHeader(0, '/products')
    const mainNav = screen.getByRole('navigation', { name: 'Main' })

    expect(within(mainNav).getByRole('link', { name: 'Shop' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(
      within(mainNav).getByRole('link', { name: 'Home' }),
    ).not.toHaveAttribute('aria-current')
  })

  it('opens and closes the mobile menu', async () => {
    renderHeader(0)
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
