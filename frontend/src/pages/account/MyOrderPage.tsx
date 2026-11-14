import { CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { Container } from '../../components/layout/Container'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { ErrorState } from '../../components/ui/ErrorState'
import { RequireCustomer } from '../../features/auth/RequireCustomer'
import { OrderItemsTable } from '../../features/orders/OrderItemsTable'
import { OrderShipments } from '../../features/orders/OrderShipments'
import {
  cancelMyOrder,
  getMyOrder,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  type CustomerOrder,
  type OrderStatus,
} from '../../features/orders/ordersApi'
import { OrderStatusBadge } from '../../features/orders/OrderStatusBadge'
import { formatDateTime } from '../../features/shipping/dates'
import { useCountries } from '../../features/shipping/useCountriesPublic'
import { useAsync } from '../../hooks/useAsync'
import { userMessage } from '../../lib/errors'

export function MyOrderPage() {
  return (
    <RequireCustomer>
      <MyOrder />
    </RequireCustomer>
  )
}

function historyLabel(status: string) {
  if (status === 'PAID') return 'Payment received'
  return ORDER_STATUS_LABELS[status as OrderStatus] ?? status
}

function MyOrder() {
  const { orderNumber = '' } = useParams()
  const location = useLocation()
  const justPlaced =
    (location.state as { placed?: boolean } | null)?.placed === true
  const { state, retry } = useAsync(
    (signal) => getMyOrder(orderNumber, signal),
    `my-order-${orderNumber}`,
  )
  const [updated, setUpdated] = useState<CustomerOrder>()
  const [confirming, setConfirming] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [error, setError] = useState<string>()
  const { nameOf } = useCountries()
  const order = updated ?? (state.status === 'success' ? state.data : undefined)

  async function cancel() {
    setIsCancelling(true)
    setError(undefined)
    try {
      setUpdated(await cancelMyOrder(orderNumber))
    } catch (e) {
      setError(userMessage(e))
    } finally {
      setIsCancelling(false)
      setConfirming(false)
    }
  }

  return (
    <Container className="py-10">
      <title>{`Order ${orderNumber} | Leenax SwiftDrop.lk`}</title>
      <Link
        to="/account/orders"
        className="text-sm font-medium text-brand-800 hover:underline"
      >
        ← My orders
      </Link>
      {state.status === 'loading' && (
        <p className="mt-6 text-slate-600">Loading order…</p>
      )}
      {state.status === 'error' && (
        <div className="mt-6">
          <ErrorState description={userMessage(state.error)} onRetry={retry} />
        </div>
      )}
      {order && (
        <>
          {justPlaced && (
            <p
              role="status"
              className="mt-6 flex items-start gap-2 rounded-lg bg-brand-50 p-4 font-medium text-brand-900"
            >
              <CheckCircle2
                className="mt-0.5 size-5 shrink-0"
                aria-hidden="true"
              />
              Thank you! Your order {order.orderNumber} has been placed.
              {order.paymentMethod === 'ARRANGE_LATER'
                ? ' We will contact you to arrange payment.'
                : ' Please have the cash ready when the parcel arrives.'}
            </p>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold text-slate-900">
              Order {order.orderNumber}
            </h1>
            <OrderStatusBadge status={order.status} />
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Placed {formatDateTime(order.createdAt)}
          </p>

          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_20rem]">
            <OrderItemsTable
              items={order.items}
              itemsTotal={order.itemsTotal}
              taxIncluded={order.taxIncluded}
              shipping={order.shippingPrice}
              shippingLabel={`${order.deliveryProvider}`}
              grandTotal={order.grandTotal}
            />
            <div className="space-y-6 text-sm">
              {order.shipments.length > 0 && (
                <section aria-labelledby="tracking-heading">
                  <h2
                    id="tracking-heading"
                    className="font-semibold text-slate-900"
                  >
                    Delivery tracking
                  </h2>
                  <div className="mt-2">
                    <OrderShipments shipments={order.shipments} />
                  </div>
                </section>
              )}
              <section aria-labelledby="pay-heading">
                <h2 id="pay-heading" className="font-semibold text-slate-900">
                  Payment
                </h2>
                <p className="mt-1 text-slate-700">
                  {PAYMENT_METHOD_LABELS[order.paymentMethod]}
                </p>
                <p className="text-slate-500">
                  {order.paymentStatus === 'PAID' ? 'Paid' : 'Not paid yet'}
                </p>
              </section>
              <section aria-labelledby="addr-heading">
                <h2 id="addr-heading" className="font-semibold text-slate-900">
                  Delivery address
                </h2>
                <address className="mt-1 not-italic text-slate-700">
                  {order.address.recipientName}
                  <br />
                  {order.address.line1}
                  {order.address.line2 && (
                    <>
                      <br />
                      {order.address.line2}
                    </>
                  )}
                  <br />
                  {[
                    order.address.city,
                    order.address.region,
                    order.address.postalCode,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                  <br />
                  {nameOf(order.address.countryCode)}
                  <br />
                  {order.address.phone}
                </address>
              </section>
              <section aria-labelledby="history-heading">
                <h2
                  id="history-heading"
                  className="font-semibold text-slate-900"
                >
                  History
                </h2>
                <ol className="mt-1 space-y-1 text-slate-700">
                  {order.history.map((h, i) => (
                    <li key={i}>
                      {historyLabel(h.status)} ·{' '}
                      <span className="text-slate-500">
                        {formatDateTime(h.at)}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
              {error && (
                <p role="alert" className="text-red-700">
                  {error}
                </p>
              )}
              {order.canCancel && (
                <Button variant="secondary" onClick={() => setConfirming(true)}>
                  Cancel order
                </Button>
              )}
            </div>
          </div>
          <ConfirmDialog
            open={confirming}
            title={`Cancel order ${order.orderNumber}?`}
            message="The order will be cancelled. This cannot be undone."
            confirmLabel="Cancel order"
            onConfirm={cancel}
            onCancel={() => setConfirming(false)}
            isWorking={isCancelling}
          />
        </>
      )}
    </Container>
  )
}
