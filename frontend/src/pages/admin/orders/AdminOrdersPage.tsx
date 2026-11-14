import { Search } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Pagination } from '../../../components/navigation/Pagination'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { Select } from '../../../components/ui/Select'
import {
  adminListOrders,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  type OrderStatus,
} from '../../../features/orders/ordersApi'
import { OrderStatusBadge } from '../../../features/orders/OrderStatusBadge'
import { formatDateTime } from '../../../features/shipping/dates'
import { useAsync } from '../../../hooks/useAsync'
import { userMessage } from '../../../lib/errors'
import { formatMoney } from '../../../lib/money'

const STATUSES = Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]

/** All orders, newest first; search by order number or recipient name. */
export function AdminOrdersPage() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const status = (params.get('status') ?? '') as OrderStatus | ''
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1)
  const [search, setSearch] = useState(q)
  const { state, retry } = useAsync(
    (signal) =>
      adminListOrders(
        { q, status: status || undefined, page: page - 1 },
        signal,
      ),
    `admin-orders-${q}-${status}-${page}`,
  )

  function apply(next: { q?: string; status?: string }) {
    const query = new URLSearchParams()
    const nq = next.q ?? q
    const ns = next.status ?? status
    if (nq) query.set('q', nq)
    if (ns) query.set('status', ns)
    setParams(query)
  }

  function onSearch(event: FormEvent) {
    event.preventDefault()
    apply({ q: search.trim() })
  }

  return (
    <>
      <title>Orders | Admin</title>
      <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
      <div className="mt-6 flex flex-wrap items-end gap-3">
        <form
          role="search"
          onSubmit={onSearch}
          className="flex min-w-0 flex-1 items-end gap-2"
        >
          <div className="min-w-0 flex-1">
            <Input
              label="Search"
              type="search"
              placeholder="Order number or recipient name"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Button type="submit" variant="secondary">
            <Search className="size-4" aria-hidden="true" /> Search
          </Button>
        </form>
        <div className="w-56">
          <Select
            label="Status"
            value={status}
            onChange={(event) => apply({ status: event.target.value })}
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="mt-6">
        {state.status === 'loading' && (
          <p className="text-slate-600">Loading orders…</p>
        )}
        {state.status === 'error' && (
          <ErrorState description={userMessage(state.error)} onRetry={retry} />
        )}
        {state.status === 'success' && state.data.content.length === 0 && (
          <EmptyState
            title={q || status ? 'No matching orders' : 'No orders yet'}
            description={
              q || status
                ? 'Try another search or status.'
                : 'Orders placed by customers appear here.'
            }
          />
        )}
        {state.status === 'success' && state.data.content.length > 0 && (
          <>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Order
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Placed
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Recipient
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Payment
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right font-semibold"
                    >
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.data.content.map((o) => (
                    <tr key={o.orderNumber}>
                      <th scope="row" className="px-4 py-3 font-medium">
                        <Link
                          to={`/admin/orders/${o.orderNumber}`}
                          className="text-brand-800 hover:underline"
                        >
                          {o.orderNumber}
                        </Link>
                      </th>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDateTime(o.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {o.recipientName} ({o.countryCode})
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {PAYMENT_METHOD_LABELS[o.paymentMethod].replace(
                          'We will contact you to arrange payment',
                          'Arrange',
                        )}
                        {' · '}
                        {o.paymentStatus === 'PAID' ? 'Paid' : 'Unpaid'}
                      </td>
                      <td className="px-4 py-3">
                        <OrderStatusBadge status={o.status} />
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {formatMoney(o.grandTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6">
              <Pagination
                page={page}
                totalPages={state.data.totalPages}
                hrefFor={(next) => {
                  const query = new URLSearchParams(params)
                  query.set('page', String(next))
                  return `?${query}`
                }}
              />
            </div>
          </>
        )}
      </div>
    </>
  )
}
