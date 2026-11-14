import { Plus, Search } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Pagination } from '../../../components/navigation/Pagination'
import { buttonClasses } from '../../../components/ui/buttonStyles'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { Select } from '../../../components/ui/Select'
import { formatDateTime } from '../../../features/shipping/dates'
import {
  listShipments,
  TRACKING_STATUS_LABELS,
  TRACKING_STATUSES,
  type TrackingStatus,
} from '../../../features/shipping/shippingApi'
import { TrackingStatusBadge } from '../../../features/shipping/TrackingStatusBadge'
import { useCountries } from '../../../features/shipping/useCountries'
import { useAsync } from '../../../hooks/useAsync'
import { userMessage } from '../../../lib/errors'

/** All shipments, newest first. Search by order reference or AWB. */
export function ShipmentsPage() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const status = (params.get('status') ?? '') as TrackingStatus | ''
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1)
  const [search, setSearch] = useState(q)
  const { nameOf } = useCountries()
  const { state, retry } = useAsync(
    (signal) =>
      listShipments({ q, status: status || undefined, page: page - 1 }, signal),
    `shipments-${q}-${status}-${page}`,
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
      <title>Shipments | Shipping | Admin</title>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Shipments</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Book the parcel on the courier&apos;s own website or office first,
            then record it here with its tracking number (AWB).
          </p>
        </div>
        <Link to="/admin/shipping/shipments/new" className={buttonClasses()}>
          <Plus className="size-4" aria-hidden="true" /> Record shipment
        </Link>
      </div>

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
              placeholder="Order reference or AWB"
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
            {TRACKING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {TRACKING_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="mt-6">
        {state.status === 'loading' && (
          <p className="text-slate-600">Loading shipments…</p>
        )}
        {state.status === 'error' && (
          <ErrorState description={userMessage(state.error)} onRetry={retry} />
        )}
        {state.status === 'success' && state.data.content.length === 0 && (
          <EmptyState
            title={q || status ? 'No matching shipments' : 'No shipments yet'}
            description={
              q || status
                ? 'Try another search or status.'
                : 'Record a parcel after booking it with the courier.'
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
                      AWB
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Courier
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Destination
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Last change
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.data.content.map((s) => (
                    <tr key={s.id}>
                      <th scope="row" className="px-4 py-3 font-medium">
                        <Link
                          to={`/admin/shipping/shipments/${s.id}`}
                          className="text-brand-800 hover:underline"
                        >
                          {s.orderReference}
                        </Link>
                      </th>
                      <td className="px-4 py-3 font-mono text-slate-700">
                        {s.awb}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {s.providerName}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {[s.destinationCity, nameOf(s.destinationCountry)]
                          .filter(Boolean)
                          .join(', ')}
                      </td>
                      <td className="px-4 py-3">
                        <TrackingStatusBadge status={s.status} />
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDateTime(s.updatedAt)}
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
