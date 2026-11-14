import { History, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Badge } from '../../../components/ui/Badge'
import { buttonClasses } from '../../../components/ui/buttonStyles'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { formatDateTime } from '../../../features/shipping/dates'
import {
  deleteMarkupRule,
  listMarkupRules,
  listProviders,
  type MarkupRule,
} from '../../../features/shipping/shippingApi'
import {
  StatusMessage,
  type Message,
} from '../../../features/shipping/StatusMessage'
import { useCountries } from '../../../features/shipping/useCountries'
import { useAsync } from '../../../hooks/useAsync'
import { userMessage } from '../../../lib/errors'

function statusOf(rule: MarkupRule) {
  if (!rule.enabled) return <Badge>Off</Badge>
  if (rule.activeNow) return <Badge tone="success">Active</Badge>
  if (new Date(rule.effectiveFrom) > new Date())
    return <Badge tone="brand">Scheduled</Badge>
  return <Badge>Ended</Badge>
}

/**
 * Platform fee rules: what the store adds on top of the courier's price.
 * This is a fee, not profit: card fees, packing and losses are not taken off.
 */
export function MarkupRulesPage() {
  const { state, retry } = useAsync(
    (signal) => listMarkupRules(signal),
    'shipping-markup',
  )
  const providers = useAsync((signal) => listProviders(signal), 'mk-providers')
  const { nameOf } = useCountries()
  const [toDelete, setToDelete] = useState<MarkupRule | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [message, setMessage] = useState<Message>()

  const providerName = (providerId: string | null) => {
    if (!providerId) return 'All couriers'
    return providers.state.status === 'success'
      ? (providers.state.data.find((p) => p.id === providerId)?.name ??
          'Unknown courier')
      : '…'
  }

  async function confirmDelete() {
    if (!toDelete) return
    setIsDeleting(true)
    try {
      await deleteMarkupRule(toDelete.id)
      setMessage({ tone: 'success', text: `"${toDelete.name}" was deleted.` })
      retry()
    } catch (error) {
      setMessage({ tone: 'error', text: userMessage(error) })
    } finally {
      setIsDeleting(false)
      setToDelete(null)
    }
  }

  return (
    <>
      <title>Platform fee | Shipping | Admin</title>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Platform fee</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Added on top of the courier&apos;s price: customer price = courier
            price + platform fee. When several rules match, the most specific
            one wins (courier and country, then courier, then country, then the
            default). This is a fee, not profit.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/admin/shipping/history?type=MARKUP_RULE"
            className={buttonClasses({ variant: 'secondary' })}
          >
            <History className="size-4" aria-hidden="true" /> History
          </Link>
          <Link to="/admin/shipping/markup/new" className={buttonClasses()}>
            <Plus className="size-4" aria-hidden="true" /> New rule
          </Link>
        </div>
      </div>

      <StatusMessage message={message} className="mt-4" />

      <div className="mt-6">
        {state.status === 'loading' && (
          <p className="text-slate-600">Loading rules…</p>
        )}
        {state.status === 'error' && (
          <ErrorState description={userMessage(state.error)} onRetry={retry} />
        )}
        {state.status === 'success' && state.data.length === 0 && (
          <EmptyState
            title="No platform fee rules"
            description="Without a rule, customers pay exactly the courier's price."
          />
        )}
        {state.status === 'success' && state.data.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Rule
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Fee
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Applies to
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Dates
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.data.map((rule) => (
                  <tr key={rule.id}>
                    <th
                      scope="row"
                      className="px-4 py-3 font-medium text-slate-900"
                    >
                      {rule.name}
                    </th>
                    <td className="px-4 py-3 text-slate-600">
                      {rule.description.replace(` (${rule.name})`, '')}
                      {(rule.minFee || rule.maxFee) && (
                        <span className="block text-xs text-slate-500">
                          {rule.minFee && `min LKR ${rule.minFee}`}
                          {rule.minFee && rule.maxFee && ', '}
                          {rule.maxFee && `max LKR ${rule.maxFee}`}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {providerName(rule.providerId)} ·{' '}
                      {rule.countryCode
                        ? nameOf(rule.countryCode)
                        : 'All countries'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      From {formatDateTime(rule.effectiveFrom)}
                      {rule.effectiveTo && (
                        <span className="block">
                          until {formatDateTime(rule.effectiveTo)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">{statusOf(rule)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Link
                          to={`/admin/shipping/markup/${rule.id}/edit`}
                          className={buttonClasses({
                            variant: 'ghost',
                            size: 'sm',
                          })}
                          aria-label={`Edit ${rule.name}`}
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </Link>
                        <button
                          type="button"
                          className={buttonClasses({
                            variant: 'ghost',
                            size: 'sm',
                          })}
                          aria-label={`Delete ${rule.name}`}
                          onClick={() => {
                            setMessage(undefined)
                            setToDelete(rule)
                          }}
                        >
                          <Trash2
                            className="size-4 text-red-700"
                            aria-hidden="true"
                          />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={toDelete !== null}
        title={`Delete "${toDelete?.name ?? ''}"?`}
        message="Quotes already given keep their fee. To stop a rule for now, edit it and turn it off instead."
        confirmLabel="Delete rule"
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
        isWorking={isDeleting}
      />
    </>
  )
}
