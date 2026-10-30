import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { CategoryCarousel } from './CategoryCarousel'
import { sampleCategories } from './sampleData'

/**
 * jsdom (the fake browser used by tests) does not calculate layout, so every
 * size is 0. We set the sizes ourselves to simulate a row wider than the screen.
 */
function setRowSize(list: HTMLElement, { scrollLeft = 0 } = {}) {
  Object.defineProperty(list, 'clientWidth', { configurable: true, value: 300 })
  Object.defineProperty(list, 'scrollWidth', {
    configurable: true,
    value: 1200,
  })
  Object.defineProperty(list, 'scrollLeft', {
    configurable: true,
    value: scrollLeft,
  })
  list.scrollBy = vi.fn()
  fireEvent.scroll(list)
}

describe('CategoryCarousel', () => {
  it('links each category to its product list', () => {
    render(
      <MemoryRouter>
        <CategoryCarousel categories={sampleCategories} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Fashion' })).toHaveAttribute(
      'href',
      '/products?category=fashion',
    )
  })

  it('shows every category name', () => {
    render(
      <MemoryRouter>
        <CategoryCarousel categories={sampleCategories} />
      </MemoryRouter>,
    )

    for (const category of sampleCategories) {
      expect(screen.getByText(category.name)).toBeInTheDocument()
    }
  })

  it('moves forward when Next is clicked', async () => {
    render(
      <MemoryRouter>
        <CategoryCarousel categories={sampleCategories} />
      </MemoryRouter>,
    )
    const list = screen.getByRole('list', { name: 'Categories' })
    setRowSize(list)

    await userEvent.click(
      screen.getByRole('button', { name: 'Next categories' }),
    )

    expect(list.scrollBy).toHaveBeenCalledWith(
      expect.objectContaining({ left: 240 }),
    )
  })

  it('disables Previous at the start and enables it after scrolling', () => {
    render(
      <MemoryRouter>
        <CategoryCarousel categories={sampleCategories} />
      </MemoryRouter>,
    )
    const list = screen.getByRole('list', { name: 'Categories' })
    const previous = screen.getByRole('button', { name: 'Previous categories' })

    setRowSize(list, { scrollLeft: 0 })
    expect(previous).toBeDisabled()

    setRowSize(list, { scrollLeft: 400 })
    expect(previous).toBeEnabled()
  })
})
