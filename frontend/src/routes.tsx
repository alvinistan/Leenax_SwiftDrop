import type { RouteObject } from 'react-router'
import { RootLayout } from './components/layout/RootLayout'
import { CartPage } from './pages/CartPage'
import { HomePage } from './pages/HomePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { ProductDetailPage } from './pages/ProductDetailPage'
import { ProductListPage } from './pages/ProductListPage'
import { RouteErrorPage } from './pages/RouteErrorPage'

/**
 * The URL map of the app. The root route is a LAYOUT route: it renders the
 * header and footer, and its children render inside its <Outlet />.
 * Used by main.tsx (real browser) and by tests (in-memory router).
 */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <HomePage /> }, // exactly "/"
      { path: 'products', element: <ProductListPage /> },
      { path: 'products/:slug', element: <ProductDetailPage /> }, // :slug = route parameter
      { path: 'cart', element: <CartPage /> },
      { path: '*', element: <NotFoundPage /> }, // anything else
    ],
  },
]
