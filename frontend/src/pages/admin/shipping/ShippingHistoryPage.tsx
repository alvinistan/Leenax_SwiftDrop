import { useSearchParams } from 'react-router'
import { Badge } from '../../../components/ui/Badge'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Pagination } from '../../../components/navigation/Pagination'
import { Select } from '../../../components/ui/Select'
import { formatDateTime } from '../../../features/shipping/dates'
import { listAudit } from '../../../features/shipping/shippingApi'
import { useAsync } from '../../../hooks/useAsync'
import { userMessage } from '../../../lib/errors'

const TYPES: Record<string, string> = {
  SETTINGS: 'Pickup settings',
  COURIER: 'Courier',
  BOX: 'Box size',
  COUNTRY_RESTRICTIONS: 'Country restrictions',
  PRODUCT_RESTRICTIONS: 'Product restrictions',
  DESTINATIONS: 'Countries we deliver to',
  SHIPMENT: 'Shipment',
  COURIER_EXPENSE: 'Courier charge',
  TAX_RATE: 'Tax rate',
  MARKUP_RULE: 'Platform fee rule',
  RATE_CARD: 'Rate card',
}

const ACTION_TONE = {
  CREATE: 'success',
  UPDATE: 'brand',
  DELETE: 'danger',
} as const

function pretty(json: string | null) {
  if (!json) return '—'
  try {
    return JSON.stringify(JSON.parse(json), null, 2)
  } catch {
    return json
  }
}

/** Who changed which shipping setting, when, and what it was before and after. */
export function ShippingHistoryPage() {
  const [params, setParams] = useSearchParams()
  const type = params.get('type') ?? ''
  // 1-based in the URL (what people see); 0-based for the API.
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1)
  const { state, retry } = useAsync(
    (signal) =>
      listAudit({ page: page - 1, size: 20, entityType: type }, signal),
    `shipping-audit-${type}-${page}`,
  )

  return (
    <>
      <title>Change history | Shipping | Admin</title>
      <h1 className="text-2xl font-bold text-slate-900">Change history</h1>
      <p className="mt-1 max-w-3xl text-sm text-slate-600">
        Every change to shipping settings, newest first. Entries cannot be
        edited or deleted.
      </p>
      <div className="mt-4 max-w-xs">
        <Select
          label="Show"
          value={type}
          onChange={(event) => {
            const next = new URLSearchParams()
            if (event.target.value) next.set('type', event.target.value)
            setParams(next)
          }}
        >
          <option value="">All changes</option>
          {Object.entries(TYPES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-6">
        {state.status === 'loading' && (
          <p className="text-slate-600">Loading history…</p>
        )}
        {state.status === 'error' && (
          <ErrorState description={userMessage(state.error)} onRetry={retry} />
        )}
        {state.status === 'success' && state.data.content.length === 0 && (
          <EmptyState
            title="No changes yet"
            description="Changes to shipping settings will appear here."
          />
        )}
        {state.status === 'success' && state.data.content.length > 0 && (
          <>
            <ol className="flex flex-col gap-3">
              {state.data.content.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge tone={ACTION_TONE[entry.action]}>
                      {entry.action.toLowerCase()}
                    </Badge>
                    <span className="font-semibold text-slate-900">
                      {TYPES[entry.entityType] ?? entry.entityType}
                    </span>
                    <span className="text-slate-500">
                      by {entry.actor} · {formatDateTime(entry.createdAt)}
                    </span>
                  </div>
                  <details className="mt-2 text-sm">
                    <summary className="cursor-pointer font-medium text-brand-800">
                      Show before and after
                    </summary>
                    <div className="mt-2 grid gap-3 md:grid-cols-2">
                      <div>
                        <p className="font-semibold text-slate-700">Before</p>
                        <pre className="mt-1 max-h-80 overflow-auto rounded-lg bg-slate-50 p-3 text-xs">
                          {pretty(entry.beforeJson)}
                        </pre>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-700">After</p>
                        <pre className="mt-1 max-h-80 overflow-auto rounded-lg bg-slate-50 p-3 text-xs">
                          {pretty(entry.afterJson)}
                        </pre>
                      </div>
                    </div>
                  </details>
                </li>
              ))}
            </ol>
            <div className="mt-6">
              <Pagination
                page={page}
                totalPages={state.data.totalPages}
                hrefFor={(next) => {
                  const query = new URLSearchParams()
                  if (type) query.set('type', type)
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
