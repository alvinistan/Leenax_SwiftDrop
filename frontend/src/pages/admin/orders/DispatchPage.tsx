import { Link } from 'react-router'
import { buttonClasses } from '../../../components/ui/buttonStyles'
import { ErrorState } from '../../../components/ui/ErrorState'
import { formatDateTime } from '../../../features/shipping/dates'
import {
  adminDispatchQueue,
  PAYMENT_METHOD_LABELS,
  type QueueEntry,
} from '../../../features/orders/ordersApi'
import { useAsync } from '../../../hooks/useAsync'
import { userMessage } from '../../../lib/errors'
import { formatMoney } from '../../../lib/money'

/**
 * The owner's to-do list: orders to confirm, orders ready to hand to a
 * courier, and confirmed orders that still wait (with why). Oldest first.
 */
export function DispatchPage() {
  const { state, retry } = useAsync(
    (signal) => adminDispatchQueue(signal),
    'dispatch-queue',
  )

  return (
    <>
      <title>Dispatch | Admin</title>
      <h1 className="text-2xl font-bold text-slate-900">Dispatch</h1>
      <p className="mt-1 max-w-3xl text-sm text-slate-600">
        What to do next, oldest first. An order is ready to ship when it is
        confirmed, paid (unless cash on delivery) and, for parcels abroad, has
        customs details for every product.
      </p>
      {state.status === 'loading' && (
        <p className="mt-6 text-slate-600">Loading…</p>
      )}
      {state.status === 'error' && (
        <div className="mt-6">
          <ErrorState description={userMessage(state.error)} onRetry={retry} />
        </div>
      )}
      {state.status === 'success' && (
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <Column
            title="Ready to ship"
            empty="Nothing to ship right now."
            entries={state.data.readyToShip}
            action={(e) => (
              <Link
                to={`/admin/shipping/shipments/new?order=${encodeURIComponent(e.order.orderNumber)}`}
                className={buttonClasses({ size: 'sm' })}
              >
                Record shipment{' '}
                <span className="sr-only">for {e.order.orderNumber}</span>
              </Link>
            )}
          />
          <Column
            title="Waiting"
            empty="No confirmed order is waiting."
            entries={state.data.waiting}
            details={(e) => (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-900">
                {e.dispatch.blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
          />
          <Column
            title="To confirm"
            empty="No new orders."
            entries={state.data.toConfirm}
          />
        </div>
      )}
    </>
  )
}

type ColumnProps = {
  title: string
  empty: string
  entries: QueueEntry[]
  action?: (e: QueueEntry) => React.ReactNode
  details?: (e: QueueEntry) => React.ReactNode
}

function Column({ title, empty, entries, action, details }: ColumnProps) {
  return (
    <section
      aria-label={title}
      className="rounded-xl border border-slate-200 bg-white p-4"
    >
      <h2 className="font-semibold text-slate-900">
        {title} <span className="text-slate-500">({entries.length})</span>
      </h2>
      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 text-sm">
          {entries.map((e) => (
            <li key={e.order.orderNumber} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  to={`/admin/orders/${e.order.orderNumber}`}
                  className="font-semibold text-brand-800 hover:underline"
                >
                  {e.order.orderNumber}
                </Link>
                <span className="font-semibold">
                  {formatMoney(e.order.grandTotal)}
                </span>
              </div>
              <p className="text-slate-600">
                {e.order.recipientName} ({e.order.countryCode}) ·{' '}
                {formatDateTime(e.order.createdAt)}
              </p>
              <p className="text-slate-500">
                {PAYMENT_METHOD_LABELS[e.order.paymentMethod]} ·{' '}
                {e.order.paymentStatus === 'PAID' ? 'paid' : 'not paid'}
              </p>
              {details?.(e)}
              {action && <div className="mt-2">{action(e)}</div>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
