import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, server } from './test/mockApi'
import { renderRoute } from './test/renderRoute'

describe('home page', () => {
  it('shows the hero and category links from the API', async () => {
    renderRoute('/')

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    // Real API mode: no "sample" banner
    expect(screen.queryByText(/not for sale/)).not.toBeInTheDocument()
    expect(
      await screen.findByRole('link', { name: 'Cakes & Bakery' }),
    ).toHaveAttribute('href', '/products?category=cakes-bakery')
  })

  it('opens a product page when a product is clicked', async () => {
    const router = renderRoute('/')

    await userEvent.click(
      await screen.findByRole('link', { name: 'Chocolate Cake' }),
    )

    expect(router.state.location.pathname).toBe('/products/chocolate-cake')
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Chocolate Cake' }),
    ).toBeInTheDocument()
  })
})

describe('product list page', () => {
  it('filters by the category in the URL and can switch category', async () => {
    const router = renderRoute('/products?category=cakes-bakery')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Cakes & Bakery' }),
    ).toBeInTheDocument()
    expect(await screen.findAllByRole('link', { name: /Cake$/ })).toHaveLength(
      2,
    )

    const filter = screen.getByRole('navigation', {
      name: 'Filter by category',
    })
    await userEvent.click(within(filter).getByRole('link', { name: 'Fashion' }))

    expect(router.state.location.search).toBe('?category=fashion')
    expect(
      await screen.findByRole('link', { name: 'Cotton Crew T-Shirt' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Chocolate Cake' }),
    ).not.toBeInTheDocument()
  })

  it('pages through results with Next and Previous', async () => {
    const router = renderRoute('/products')

    expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: 'Next' }))

    expect(router.state.location.search).toBe('?page=2')
    expect(await screen.findByText('Page 2 of 2')).toBeInTheDocument()
    // 12 sample products, 8 per page → 4 on page 2
    expect(
      screen
        .getAllByRole('link', { name: /./ })
        .filter((l) => l.getAttribute('href')?.startsWith('/products/')),
    ).toHaveLength(4)
  })

  it('keeps the sort order in the URL and starts again at page 1', async () => {
    const router = renderRoute('/products?page=2')

    await userEvent.selectOptions(
      await screen.findByLabelText('Sort by'),
      'name',
    )

    expect(router.state.location.search).toBe('?sort=name')
  })

  it('explains when a category has no products', async () => {
    renderRoute('/products?category=gifts')

    expect(
      await screen.findByRole('heading', { name: 'No products found' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'View all products' }),
    ).toBeInTheDocument()
  })
})

describe('product details page', () => {
  it('lets the customer choose a size or a custom weight', async () => {
    renderRoute('/products/chocolate-cake')

    // Choose the variant sold by weight
    await userEvent.click(
      await screen.findByRole('radio', { name: /Custom weight/ }),
    )
    const weight = screen.getByRole('group', { name: 'Weight' })
    expect(within(weight).getByText('0.5 kg')).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: 'Increase weight' }),
    )
    expect(within(weight).getByText('1 kg')).toBeInTheDocument()
    // 4,200.00 per kg × 1 kg
    expect(screen.getByText(/LKR\s4,200\.00$/)).toBeInTheDocument()

    // Switching to a fixed size goes back to whole pieces
    await userEvent.click(screen.getByRole('radio', { name: /1 kg cake/ }))
    expect(screen.getByRole('group', { name: 'Quantity' })).toHaveTextContent(
      '1',
    )
    expect(
      screen.getByRole('button', { name: 'Decrease quantity' }),
    ).toBeDisabled()
  })

  it('updates the header cart count when added to the cart', async () => {
    renderRoute('/products/ceramic-coffee-mug')

    await userEvent.click(
      await screen.findByRole('button', { name: 'Add to cart' }),
    )

    expect(
      screen.getByRole('link', { name: 'Cart, 1 item' }),
    ).toBeInTheDocument()
    // (Not getByRole('status'): the quantity <output> element also has the status role.)
    expect(screen.getByText(/Added to cart/)).toBeInTheDocument()
  })

  it('does not ask for a choice when there is only one variant', async () => {
    renderRoute('/products/ceramic-coffee-mug')

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'Ceramic Coffee Mug',
    )
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })

  it('shows a friendly message for an unknown product', async () => {
    renderRoute('/products/does-not-exist')

    expect(
      await screen.findByRole('heading', { name: 'Product not found' }),
    ).toBeInTheDocument()
  })
})

describe('when the API fails', () => {
  it('shows a friendly error, and "Try again" recovers', async () => {
    // First request fails as if the server were down; later ones use the normal handler.
    server.use(
      http.get(`${API}/api/products`, () => HttpResponse.error(), {
        once: true,
      }),
    )
    renderRoute('/products')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /couldn't reach the store/,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(
      await screen.findByRole('link', { name: 'Chocolate Cake' }),
    ).toBeInTheDocument()
  })
})

describe('unknown URLs', () => {
  it('show the 404 page inside the normal layout', () => {
    renderRoute('/this/page/does/not/exist')

    expect(
      screen.getByRole('heading', { name: 'Page not found' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument()
  })
})
