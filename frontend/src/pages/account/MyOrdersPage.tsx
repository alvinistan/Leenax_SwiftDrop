import { Link, useSearchParams } from 'react-router'
import { Container } from '../../components/layout/Container'
import { Pagination } from '../../components/navigation/Pagination'
import { buttonClasses } from '../../components/ui/buttonStyles'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { RequireCustomer } from '../../features/auth/RequireCustomer'
import { listMyOrders } from '../../features/orders/ordersApi'
import { OrderStatusBadge } from '../../features/orders/OrderStatusBadge'
import { formatDateTime } from '../../features/shipping/dates'
import { useAsync } from '../../hooks/useAsync'
import { userMessage } from '../../lib/errors'
import { formatMoney } from '../../lib/money'

export function MyOrdersPage() {
  return (
    <RequireCustomer>
      <MyOrders />
    </RequireCustomer>
  )
}

function MyOrders() {
  const [params] = useSearchParams()
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1)
  const { state, retry } = useAsync(
    (signal) => listMyOrders(page - 1, signal),
    `my-orders-${page}`,
  )

  return (
    <Container className="py-10">
      <title>My orders | Leenax SwiftDrop.lk</title>
      <h1 className="text-3xl font-bold text-slate-900">My orders</h1>
      <div className="mt-8">
        {state.status === 'loading' && (
          <p className="text-slate-600">Loading your orders…</p>
        )}
        {state.status === 'error' && (
          <ErrorState description={userMessage(state.error)} onRetry={retry} />
        )}
        {state.status === 'success' && state.data.content.length === 0 && (
          <EmptyState
            title="No orders yet"
            description="When you place an order, you can follow it here."
            action={
              <Link to="/products" className={buttonClasses()}>
                Start shopping
              </Link>
            }
          />
        )}
        {state.status === 'success' && state.data.content.length > 0 && (
          <>
            <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
              {state.data.content.map((o) => (
                <li
                  key={o.orderNumber}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div>
                    <Link
                      to={`/account/orders/${o.orderNumber}`}
                      className="font-semibold text-brand-800 hover:underline"
                    >
                      Order {o.orderNumber}
                    </Link>
                    <p className="text-sm text-slate-600">
                      {formatDateTime(o.createdAt)} · {o.itemCount} item
                      {o.itemCount === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <OrderStatusBadge status={o.status} />
                    <span className="font-semibold">
                      {formatMoney(o.grandTotal)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <Pagination
                page={page}
                totalPages={state.data.totalPages}
                hrefFor={(p) => `?page=${p}`}
              />
            </div>
          </>
        )}
      </div>
    </Container>
  )
}
