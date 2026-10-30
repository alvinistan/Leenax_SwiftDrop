import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { routes } from '../routes'

/**
 * Renders the whole app at a URL, using the real route table but an
 * in-memory history (tests have no browser address bar).
 * Returns the router so tests can check router.state.location.
 */
export function renderRoute(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}
