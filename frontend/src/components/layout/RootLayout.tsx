import { Outlet, ScrollRestoration } from 'react-router'
import { CartProvider } from '../../features/cart/CartContext'
import { useCart } from '../../features/cart/useCart'
import { AppLayout } from './AppLayout'

/**
 * The layout route: wraps every page with the header and footer. <Outlet />
 * is where the current page (Home, product list, ...) is rendered. The cart
 * is shared with every page through CartProvider (saved in this browser).
 */
export function RootLayout() {
  return (
    <CartProvider>
      <Frame />
    </CartProvider>
  )
}

function Frame() {
  const { count } = useCart()
  return (
    <AppLayout cartCount={count}>
      <Outlet />
      {/* Scroll to the top on each new page, and back to where you were on "Back". */}
      <ScrollRestoration />
    </AppLayout>
  )
}
