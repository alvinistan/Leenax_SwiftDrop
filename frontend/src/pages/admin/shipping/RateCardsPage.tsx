import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Badge } from '../../../components/ui/Badge'
import { buttonClasses } from '../../../components/ui/buttonStyles'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import {
  deleteRateCard,
  listRateCards,
  type RateCard,
} from '../../../features/shipping/shippingApi'
import {
  StatusMessage,
  type Message,
} from '../../../features/shipping/StatusMessage'
import { useCountries } from '../../../features/shipping/useCountries'
import { useAsync } from '../../../hooks/useAsync'
import { userMessage } from '../../../lib/errors'
import { formatMoney } from '../../../lib/money'

/** Courier price lists typed in by the admin. The system never invents prices. */
export function RateCardsPage() {
  const { state, retry } = useAsync(
    (signal) => listRateCards(signal),
    'shipping-rate-cards',
  )
  const { nameOf } = useCountries()
  const [toDelete, setToDelete] = useState<RateCard | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [message, setMessage] = useState<Message>()

  async function confirmDelete() {
    if (!toDelete) return
    setIsDeleting(true)
    try {
      await deleteRateCard(toDelete.id)
      setMessage({ tone: 'success', text: 'Rate card deleted.' })
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
      <title>Rate cards | Shipping | Admin</title>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Rate cards</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Courier prices by weight, per destination country, in LKR. Copy them
            from the courier&apos;s official price list.
          </p>
        </div>
        <Link to="/admin/shipping/rate-cards/new" className={buttonClasses()}>
          <Plus className="size-4" aria-hidden="true" /> New rate card
        </Link>
      </div>

      <StatusMessage message={message} className="mt-4" />

      <div className="mt-6">
        {state.status === 'loading' && (
          <p className="text-slate-600">Loading rate cards…</p>
        )}
        {state.status === 'error' && (
          <ErrorState description={userMessage(state.error)} onRetry={retry} />
        )}
        {state.status === 'success' && state.data.length === 0 && (
          <EmptyState
            title="No rate cards yet"
            description="Add the DEX price list for Sri Lanka so customers can get domestic delivery prices."
          />
        )}
        {state.status === 'success' && state.data.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Courier service
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Destination
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Weight bands
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
                {state.data.map((card) => {
                  const last = card.bands[card.bands.length - 1]
                  return (
                    <tr key={card.id}>
                      <th
                        scope="row"
                        className="px-4 py-3 font-medium text-slate-900"
                      >
                        {card.providerName} · {card.serviceName}
                      </th>
                      <td className="px-4 py-3 text-slate-600">
                        {nameOf(card.countryCode)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {card.bands.length} band
                        {card.bands.length === 1 ? '' : 's'}, up to{' '}
                        {last.maxWeightKg} kg (
                        {formatMoney({
                          amount: card.bands[0].price,
                          currency: card.currency,
                        })}{' '}
                        –{' '}
                        {formatMoney({
                          amount: last.price,
                          currency: card.currency,
                        })}
                        )
                      </td>
                      <td className="px-4 py-3">
                        {card.enabled ? (
                          <Badge tone="success">In use</Badge>
                        ) : (
                          <Badge>Not used</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Link
                            to={`/admin/shipping/rate-cards/${card.id}/edit`}
                            className={buttonClasses({
                              variant: 'ghost',
                              size: 'sm',
                            })}
                            aria-label={`Edit ${card.providerName} rate card for ${nameOf(card.countryCode)}`}
                          >
                            <Pencil className="size-4" aria-hidden="true" />
                          </Link>
                          <button
                            type="button"
                            className={buttonClasses({
                              variant: 'ghost',
                              size: 'sm',
                            })}
                            aria-label={`Delete ${card.providerName} rate card for ${nameOf(card.countryCode)}`}
                            onClick={() => {
                              setMessage(undefined)
                              setToDelete(card)
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
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete this rate card?"
        message="Customers will no longer get prices from it. Quotes already given keep their prices."
        confirmLabel="Delete rate card"
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
        isWorking={isDeleting}
      />
    </>
  )
}
