import type { RouteObject } from 'react-router'
import { RootLayout } from './components/layout/RootLayout'
import { PageLoading } from './components/ui/PageLoading'
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
 *
 * Login and admin pages are LAZY: their code (and the form libraries they use)
 * is downloaded only when someone opens them, so shoppers get a smaller,
 * faster download. `import()` returns a Promise of the module.
 */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <RouteErrorPage />,
    // Shown if the first page opened is a lazy one (e.g. /login) while its code downloads.
    hydrateFallbackElement: <PageLoading />,
    children: [
      { index: true, element: <HomePage /> }, // exactly "/"
      { path: 'products', element: <ProductListPage /> },
      { path: 'products/:slug', element: <ProductDetailPage /> }, // :slug = route parameter
      { path: 'cart', element: <CartPage /> },
      {
        path: 'login',
        lazy: async () => ({
          Component: (await import('./pages/LoginPage')).LoginPage,
        }),
      },
      { path: '*', element: <NotFoundPage /> }, // anything else
    ],
  },
  {
    // The admin area has its own layout. AdminLayout only lets admins in;
    // the server checks again on every API call.
    path: '/admin',
    lazy: async () => ({
      Component: (await import('./components/layout/AdminLayout')).AdminLayout,
    }),
    errorElement: <RouteErrorPage />,
    hydrateFallbackElement: <PageLoading />,
    children: [
      {
        index: true,
        lazy: async () => ({
          Component: (await import('./pages/admin/AdminDashboardPage'))
            .AdminDashboardPage,
        }),
      },
      {
        path: 'categories',
        lazy: async () => ({
          Component: (await import('./pages/admin/AdminCategoriesPage'))
            .AdminCategoriesPage,
        }),
      },
      {
        path: 'categories/new',
        lazy: async () => ({
          Component: (await import('./pages/admin/AdminCategoryFormPage'))
            .AdminCategoryFormPage,
        }),
      },
      {
        path: 'categories/:id/edit',
        lazy: async () => ({
          Component: (await import('./pages/admin/AdminCategoryFormPage'))
            .AdminCategoryFormPage,
        }),
      },
      {
        path: 'products',
        lazy: async () => ({
          Component: (await import('./pages/admin/AdminProductsPage'))
            .AdminProductsPage,
        }),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
