import { useState } from 'react'
import { Outlet, ScrollRestoration } from 'react-router'
import { AppLayout } from './AppLayout'

/** What child pages can use from the layout, via useOutletContext(). */
export type RootOutletContext = {
  addToCart: () => void
}

/**
 * The layout route: wraps every page with the header and footer. <Outlet />
 * is where the current page (Home, product list, ...) is rendered.
 */
export function RootLayout() {
  // Preview only: a real cart arrives in Phase 8 and is stored on the server.
  const [cartCount, setCartCount] = useState(0)

  const context: RootOutletContext = {
    addToCart: () => setCartCount((count) => count + 1),
  }

  return (
    <AppLayout cartCount={cartCount}>
      <Outlet context={context} />
      {/* Scroll to the top on each new page, and back to where you were on "Back". */}
      <ScrollRestoration />
    </AppLayout>
  )
}
