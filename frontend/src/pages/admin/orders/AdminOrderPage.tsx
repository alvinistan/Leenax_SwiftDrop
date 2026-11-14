import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { buttonClasses } from '../../../components/ui/buttonStyles'
import { OrderItemsTable } from '../../../features/orders/OrderItemsTable'
import { OrderShipments } from '../../../features/orders/OrderShipments'
import {
  adminChangeStatus,
  adminGetOrder,
  adminMarkPaid,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  type AdminOrder,
  type OrderStatus,
} from '../../../features/orders/ordersApi'
import { OrderStatusBadge } from '../../../features/orders/OrderStatusBadge'
import { formatDateTime } from '../../../features/shipping/dates'
import {
  StatusMessage,
  type Message,
} from '../../../features/shipping/StatusMessage'
import { useCountries } from '../../../features/shipping/useCountriesPublic'
import { useAsync } from '../../../hooks/useAsync'
import { userMessage } from '../../../lib/errors'
import { formatMoney } from '../../../lib/money'

const ACTION_LABELS: Record<OrderStatus, string> = {
  PLACED: 'Placed',
  CONFIRMED: 'Confirm order',
  SHIPPED: 'Mark as shipped',
  DELIVERED: 'Mark as delivered',
  CANCELLED: 'Cancel order',
}

/** One order for the owner: items, delivery cost breakdown, address, actions. */
export function AdminOrderPage() {
  const { orderNumber = '' } = useParams()
  const { state, retry } = useAsync(
    (signal) => adminGetOrder(orderNumber, signal),
    `admin-order-${orderNumber}`,
  )
  const [updated, setUpdated] = useState<AdminOrder>()
  const order = updated ?? (state.status === 'success' ? state.data : undefined)

  return (
    <>
      <title>{`Order ${orderNumber} | Admin`}</title>
      <Link
        to="/admin/orders"
        className="inline-flex items-center gap-1 text-sm font-medium text-brand-800 hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Orders
      </Link>
      {state.status === 'loading' && (
        <p className="mt-6 text-slate-600">Loading order…</p>
      )}
      {state.status === 'error' && (
        <div className="mt-6">
          <ErrorState description={userMessage(state.error)} onRetry={retry} />
        </div>
      )}
      {order && <OrderView order={order} onUpdated={setUpdated} />}
    </>
  )
}

function OrderView({
  order,
  onUpdated,
}: {
  order: AdminOrder
  onUpdated: (o: AdminOrder) => void
}) {
  const { nameOf } = useCountries()
  const [note, setNote] = useState('')
  const [message, setMessage] = useState<Message>()
  const [busy, setBusy] = useState<string>()

  async function run(label: string, action: () => Promise<AdminOrder>) {
    setBusy(label)
    setMessage(undefined)
    try {
      onUpdated(await action())
      setNote('')
      setMessage({ tone: 'success', text: 'Order updated.' })
    } catch (error) {
      setMessage({ tone: 'error', text: userMessage(error) })
    } finally {
      setBusy(undefined)
    }
  }

  const s = order.shipping
  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-900">
          Order {order.orderNumber}
        </h1>
        <OrderStatusBadge status={order.status} />
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Placed {formatDateTime(order.createdAt)} by {order.customerName} (
        {order.customerEmail})
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <OrderItemsTable
            items={order.items}
            itemsTotal={order.itemsTotal}
            taxIncluded={order.taxIncluded}
            shipping={s.customerPrice}
            shippingLabel={`${s.providerName} · ${s.serviceName}`}
            grandTotal={order.grandTotal}
          />
          <Card className="p-5 text-sm">
            <h2 className="font-semibold text-slate-900">
              Delivery price breakdown
            </h2>
            <dl className="mt-2 grid gap-1 sm:grid-cols-2">
              <dt className="text-slate-600">Courier price</dt>
              <dd>{formatMoney(s.courierPrice)}</dd>
              <dt className="text-slate-600">Platform fee</dt>
              <dd>
                {formatMoney(s.platformFee)}{' '}
                <span className="text-slate-500">({s.markupDescription})</span>
              </dd>
              <dt className="text-slate-600">Customer paid for delivery</dt>
              <dd>{formatMoney(s.customerPrice)}</dd>
              <dt className="text-slate-600">Chargeable weight</dt>
              <dd>{s.chargeableWeightKg} kg</dd>
            </dl>
            <p className="mt-2 text-xs text-slate-500">
              Confirm the order, book the parcel with {s.providerName}, then use
              “Record shipment” below.
            </p>
          </Card>
          <Card className="p-5 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-slate-900">Shipments</h2>
              {order.dispatch.ready && (
                <Link
                  to={`/admin/shipping/shipments/new?order=${encodeURIComponent(order.orderNumber)}`}
                  className={buttonClasses({
                    variant: 'secondary',
                    size: 'sm',
                  })}
                >
                  Record shipment
                </Link>
              )}
            </div>
            <DispatchStatus order={order} />
            {order.shipments.length === 0 ? (
              <p className="mt-2 text-slate-500">No parcel recorded yet.</p>
            ) : (
              <div className="mt-3">
                <OrderShipments shipments={order.shipments} />
                <ul className="mt-2 space-y-1">
                  {order.shipments.map((s) => (
                    <li key={s.id}>
                      <Link
                        to={`/admin/shipping/shipments/${s.id}`}
                        className="font-semibold text-brand-800 hover:underline"
                      >
                        Open shipment {s.awb}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
          <Card className="p-5 text-sm">
            <h2 className="font-semibold text-slate-900">History</h2>
            <ol className="mt-2 space-y-1">
              {order.history.map((h, i) => (
                <li key={i}>
                  <span className="font-medium">
                    {h.status === 'NOTE'
                      ? 'Internal note'
                      : h.status === 'PAID'
                        ? 'Payment received'
                        : (ORDER_STATUS_LABELS[h.status as OrderStatus] ??
                          h.status)}
                  </span>
                  {h.note && ` · ${h.note}`}
                  <span className="text-slate-500">
                    {' '}
                    · {h.actor} · {formatDateTime(h.at)}
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5 text-sm">
            <h2 className="font-semibold text-slate-900">Payment</h2>
            <p className="mt-1">{PAYMENT_METHOD_LABELS[order.paymentMethod]}</p>
            <p className="font-medium">
              {order.paymentStatus === 'PAID' ? 'Paid' : 'Not paid yet'}
            </p>
          </Card>
          <Card className="p-5 text-sm">
            <h2 className="font-semibold text-slate-900">Deliver to</h2>
            <address className="mt-1 not-italic">
              {order.address.recipientName}
              <br />
              {order.address.phone}
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
            </address>
            {order.note && (
              <p className="mt-2 rounded bg-slate-50 p-2">
                Customer note: {order.note}
              </p>
            )}
          </Card>
          <Card className="p-5">
            <h2 className="font-semibold text-slate-900">Actions</h2>
            <div className="mt-3">
              <Input
                label="Note (optional)"
                hint="The customer can see this note in their order history."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {order.allowedNextStatuses.map((next) => (
                <Button
                  key={next}
                  variant={next === 'CANCELLED' ? 'danger' : 'primary'}
                  isLoading={busy === next}
                  disabled={busy !== undefined}
                  onClick={() =>
                    run(next, () =>
                      adminChangeStatus(order.orderNumber, next, note || null),
                    )
                  }
                >
                  {ACTION_LABELS[next]}
                </Button>
              ))}
              {order.paymentStatus === 'UNPAID' &&
                order.status !== 'CANCELLED' && (
                  <Button
                    variant="secondary"
                    isLoading={busy === 'PAID'}
                    disabled={busy !== undefined}
                    onClick={() =>
                      run('PAID', () =>
                        adminMarkPaid(order.orderNumber, note || null),
                      )
                    }
                  >
                    Mark as paid
                  </Button>
                )}
            </div>
            {order.allowedNextStatuses.length === 0 && (
              <p className="mt-2 text-sm text-slate-500">
                This order is finished.
              </p>
            )}
            <StatusMessage message={message} className="mt-3" />
          </Card>
        </div>
      </div>
    </>
  )
}

/** Can this order be handed to a courier now? If not, why not. */
function DispatchStatus({ order }: { order: AdminOrder }) {
  const d = order.dispatch
  if (
    order.status !== 'CONFIRMED' &&
    order.status !== 'SHIPPED' &&
    order.status !== 'PLACED'
  ) {
    return null
  }
  return (
    <div className="mt-3 space-y-2" aria-label="Ready to ship?" role="group">
      {d.ready ? (
        order.shipments.length === 0 && (
          <p className="rounded-lg bg-emerald-50 p-2 text-emerald-800">
            Ready to ship: book the parcel with {order.shipping.providerName},
            then record it here.
          </p>
        )
      ) : (
        <ul className="list-disc space-y-1 rounded-lg bg-amber-50 py-2 pr-2 pl-6 text-amber-900">
          {d.blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}
      {d.warnings.map((w) => (
        <p key={w} className="rounded-lg bg-amber-50 p-2 text-amber-900">
          {w}
        </p>
      ))}
      {d.paymentOverridable && (
        <Link
          to={`/admin/shipping/shipments/new?order=${encodeURIComponent(order.orderNumber)}&beforePayment=1`}
          className="font-semibold text-brand-800 hover:underline"
        >
          Ship before payment (with a reason)
        </Link>
      )}
    </div>
  )
}
