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
        path: 'register',
        lazy: async () => ({
          Component: (await import('./pages/RegisterPage')).RegisterPage,
        }),
      },
      {
        path: 'checkout',
        lazy: async () => ({
          Component: (await import('./pages/CheckoutPage')).CheckoutPage,
        }),
      },
      {
        path: 'account/orders',
        lazy: async () => ({
          Component: (await import('./pages/account/MyOrdersPage'))
            .MyOrdersPage,
        }),
      },
      {
        path: 'account/orders/:orderNumber',
        lazy: async () => ({
          Component: (await import('./pages/account/MyOrderPage')).MyOrderPage,
        }),
      },
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
      {
        path: 'products/new',
        lazy: async () => ({
          Component: (await import('./pages/admin/AdminProductFormPage'))
            .AdminProductFormPage,
        }),
      },
      {
        path: 'products/:id/edit',
        lazy: async () => ({
          Component: (await import('./pages/admin/AdminProductFormPage'))
            .AdminProductFormPage,
        }),
      },
      {
        path: 'dispatch',
        lazy: async () => ({
          Component: (await import('./pages/admin/orders/DispatchPage'))
            .DispatchPage,
        }),
      },
      {
        path: 'orders',
        lazy: async () => ({
          Component: (await import('./pages/admin/orders/AdminOrdersPage'))
            .AdminOrdersPage,
        }),
      },
      {
        path: 'orders/:orderNumber',
        lazy: async () => ({
          Component: (await import('./pages/admin/orders/AdminOrderPage'))
            .AdminOrderPage,
        }),
      },
      {
        path: 'tax-rates',
        lazy: async () => ({
          Component: (await import('./pages/admin/AdminTaxRatesPage'))
            .AdminTaxRatesPage,
        }),
      },
      {
        // Shipping management (Shipping Phase C): its own sub-menu layout.
        path: 'shipping',
        lazy: async () => ({
          Component: (await import('./pages/admin/shipping/ShippingLayout'))
            .ShippingLayout,
        }),
        children: [
          {
            index: true,
            lazy: async () => ({
              Component: (
                await import('./pages/admin/shipping/ShippingOverviewPage')
              ).ShippingOverviewPage,
            }),
          },
          {
            path: 'reports',
            lazy: async () => ({
              Component: (
                await import('./pages/admin/shipping/ShippingReportsPage')
              ).ShippingReportsPage,
            }),
          },
          {
            path: 'tracking',
            lazy: async () => ({
              Component: (await import('./pages/admin/shipping/TrackingPage'))
                .TrackingPage,
            }),
          },
          {
            path: 'expenses',
            lazy: async () => ({
              Component: (await import('./pages/admin/shipping/ExpensesPage'))
                .ExpensesPage,
            }),
          },
          {
            path: 'shipments',
            lazy: async () => ({
              Component: (await import('./pages/admin/shipping/ShipmentsPage'))
                .ShipmentsPage,
            }),
          },
          {
            path: 'shipments/new',
            lazy: async () => ({
              Component: (
                await import('./pages/admin/shipping/ShipmentFormPage')
              ).ShipmentFormPage,
            }),
          },
          {
            path: 'shipments/:id',
            lazy: async () => ({
              Component: (
                await import('./pages/admin/shipping/ShipmentDetailPage')
              ).ShipmentDetailPage,
            }),
          },
          {
            path: 'shipments/:id/edit',
            lazy: async () => ({
              Component: (
                await import('./pages/admin/shipping/ShipmentFormPage')
              ).ShipmentFormPage,
            }),
          },
          {
            path: 'providers',
            lazy: async () => ({
              Component: (
                await import('./pages/admin/shipping/CourierProvidersPage')
              ).CourierProvidersPage,
            }),
          },
          {
            path: 'rate-cards',
            lazy: async () => ({
              Component: (await import('./pages/admin/shipping/RateCardsPage'))
                .RateCardsPage,
            }),
          },
          {
            path: 'rate-cards/new',
            lazy: async () => ({
              Component: (
                await import('./pages/admin/shipping/RateCardFormPage')
              ).RateCardFormPage,
            }),
          },
          {
            path: 'rate-cards/:id/edit',
            lazy: async () => ({
              Component: (
                await import('./pages/admin/shipping/RateCardFormPage')
              ).RateCardFormPage,
            }),
          },
          {
            path: 'markup',
            lazy: async () => ({
              Component: (
                await import('./pages/admin/shipping/MarkupRulesPage')
              ).MarkupRulesPage,
            }),
          },
          {
            path: 'markup/new',
            lazy: async () => ({
              Component: (
                await import('./pages/admin/shipping/MarkupRuleFormPage')
              ).MarkupRuleFormPage,
            }),
          },
          {
            path: 'markup/:id/edit',
            lazy: async () => ({
              Component: (
                await import('./pages/admin/shipping/MarkupRuleFormPage')
              ).MarkupRuleFormPage,
            }),
          },
          {
            path: 'restrictions',
            lazy: async () => ({
              Component: (
                await import('./pages/admin/shipping/CountryRestrictionsPage')
              ).CountryRestrictionsPage,
            }),
          },
          {
            path: 'settings',
            lazy: async () => ({
              Component: (
                await import('./pages/admin/shipping/ShippingSettingsPage')
              ).ShippingSettingsPage,
            }),
          },
          {
            path: 'simulator',
            lazy: async () => ({
              Component: (
                await import('./pages/admin/shipping/QuoteSimulatorPage')
              ).QuoteSimulatorPage,
            }),
          },
          {
            path: 'history',
            lazy: async () => ({
              Component: (
                await import('./pages/admin/shipping/ShippingHistoryPage')
              ).ShippingHistoryPage,
            }),
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
