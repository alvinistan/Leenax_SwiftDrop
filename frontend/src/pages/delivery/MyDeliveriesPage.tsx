import { Banknote, ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { getMyJobs } from '../../features/delivery/deliveryApi'
import { TrackingStatusBadge } from '../../features/shipping/TrackingStatusBadge'
import { useAsync } from '../../hooks/useAsync'
import { userMessage } from '../../lib/errors'
import { formatMoney } from '../../lib/money'

/** /delivery: the parcels this staff member still has to deliver. */
export function MyDeliveriesPage() {
  const { state, retry } = useAsync((signal) => getMyJobs(signal), 'my-jobs')

  return (
    <>
      <title>My deliveries | Leenax SwiftDrop.lk</title>
      <h1 className="text-2xl font-bold text-slate-900">My deliveries</h1>
      <div className="mt-4">
        {state.status === 'loading' && (
          <p className="text-slate-600">Loading…</p>
        )}
        {state.status === 'error' && (
          <ErrorState description={userMessage(state.error)} onRetry={retry} />
        )}
        {state.status === 'success' && state.data.length === 0 && (
          <EmptyState
            title="Nothing to deliver"
            description="New deliveries appear here when the owner gives them to you."
          />
        )}
        {state.status === 'success' && state.data.length > 0 && (
          <ul className="space-y-3">
            {state.data.map((job) => (
              <li key={job.id}>
                <Link
                  to={`/delivery/${job.id}`}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 hover:border-brand-300"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">
                      {job.recipientName ?? job.orderNumber}
                      {job.city && (
                        <span className="font-normal text-slate-600">
                          {' '}
                          · {job.city}
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-slate-600">
                      {job.orderNumber} · {job.reference}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <TrackingStatusBadge status={job.status} />
                      {job.cashToCollect && (
                        <Badge tone="warning">
                          <Banknote className="size-3.5" aria-hidden="true" />{' '}
                          Collect {formatMoney(job.cashToCollect)}
                        </Badge>
                      )}
                      {job.failedAttempts > 0 && (
                        <Badge>{job.failedAttempts} failed attempt(s)</Badge>
                      )}
                    </div>
                  </div>
                  <ChevronRight
                    className="size-5 shrink-0 text-slate-400"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
