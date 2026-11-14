import { useState } from 'react'
import { Link } from 'react-router'
import { Badge } from '../../../components/ui/Badge'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { formatDateTime } from '../../../features/shipping/dates'
import { listShipments } from '../../../features/shipping/shippingApi'
import { TrackingStatusBadge } from '../../../features/shipping/TrackingStatusBadge'
import { useAsync } from '../../../hooks/useAsync'
import { userMessage } from '../../../lib/errors'

/** A parcel with no tracking update for this long is highlighted. */
const STALE_DAYS = 2
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Parcels still on their way, least recently updated first: check these on
 * the courier's tracking page and add the latest status.
 */
export function TrackingPage() {
  const { state, retry } = useAsync(
    (signal) =>
      listShipments({ active: true, order: 'updated', size: 100 }, signal),
    'tracking-active',
  )
  // Read the clock once (not on every render).
  const [now] = useState(() => Date.now())

  return (
    <>
      <title>Tracking | Shipping | Admin</title>
      <h1 className="text-2xl font-bold text-slate-900">Tracking</h1>
      <p className="mt-1 max-w-3xl text-sm text-slate-600">
        Parcels on their way, the least recently updated first. Open each one,
        check the courier&apos;s tracking page and add the latest status.
      </p>
      <div className="mt-6">
        {state.status === 'loading' && (
          <p className="text-slate-600">Loading parcels…</p>
        )}
        {state.status === 'error' && (
          <ErrorState description={userMessage(state.error)} onRetry={retry} />
        )}
        {state.status === 'success' && state.data.content.length === 0 && (
          <EmptyState
            title="Nothing on its way"
            description="All recorded parcels are delivered, returned or cancelled."
          />
        )}
        {state.status === 'success' && state.data.content.length > 0 && (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {state.data.content.map((s) => {
              const days = Math.floor(
                (now - new Date(s.updatedAt).getTime()) / DAY_MS,
              )
              return (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div>
                    <Link
                      to={`/admin/shipping/shipments/${s.id}`}
                      className="font-semibold text-brand-800 hover:underline"
                    >
                      {s.orderReference} ·{' '}
                      <span className="font-mono">{s.awb}</span>
                    </Link>
                    <p className="text-sm text-slate-600">
                      {s.providerName} · last update{' '}
                      {formatDateTime(s.updatedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {days >= STALE_DAYS && (
                      <Badge tone="warning">No update for {days} days</Badge>
                    )}
                    <TrackingStatusBadge status={s.status} />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </>
  )
}
