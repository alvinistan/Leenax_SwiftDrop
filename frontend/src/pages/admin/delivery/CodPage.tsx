import { useState } from 'react'
import { Link } from 'react-router'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import {
  getCodOverview,
  settleCod,
  type CodCollection,
  type CodOverview,
} from '../../../features/delivery/deliveryApi'
import { formatDateTime } from '../../../features/shipping/dates'
import {
  StatusMessage,
  type Message,
} from '../../../features/shipping/StatusMessage'
import { useAsync } from '../../../hooks/useAsync'
import { userMessage } from '../../../lib/errors'
import { fromScaled, toScaled } from '../../../lib/decimal'
import { formatMoney } from '../../../lib/money'

/**
 * /admin/delivery/cod: cash customers paid on delivery that a courier or a
 * staff member still holds. An order is marked paid only when the cash
 * reaches you.
 */
export function CodPage() {
  const { state, retry } = useAsync((signal) => getCodOverview(signal), 'cod')
  const [updated, setUpdated] = useState<CodOverview>()
  const overview =
    updated ?? (state.status === 'success' ? state.data : undefined)

  return (
    <>
      <title>Cash on delivery | Admin</title>
      <h1 className="text-2xl font-bold text-slate-900">Cash on delivery</h1>
      <p className="mt-1 max-w-3xl text-sm text-slate-600">
        When a cash-on-delivery parcel is delivered, the courier or your staff
        member holds the cash. Tick the orders whose cash you have received:
        they are then marked as paid.
      </p>
      <div className="mt-6">
        {state.status === 'loading' && (
          <p className="text-slate-600">Loading…</p>
        )}
        {state.status === 'error' && (
          <ErrorState description={userMessage(state.error)} onRetry={retry} />
        )}
        {overview && <Overview overview={overview} onUpdated={setUpdated} />}
      </div>
    </>
  )
}

function Overview({
  overview,
  onUpdated,
}: {
  overview: CodOverview
  onUpdated: (o: CodOverview) => void
}) {
  const [selected, setSelected] = useState<string[]>([])
  const [reference, setReference] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<Message>()
  const chosen = overview.held.filter((c) => selected.includes(c.id))
  // Exact decimal sum (no floating point for money).
  const chosenAmount = {
    amount: fromScaled(
      chosen.reduce((sum, c) => sum + toScaled(c.amount.amount, 2), 0n),
      2,
    ),
    currency: 'LKR',
  }

  async function settle() {
    setIsSaving(true)
    setMessage(undefined)
    try {
      const saved = await settleCod(selected, reference.trim() || null)
      onUpdated(saved)
      setMessage({
        tone: 'success',
        text: `${selected.length} order(s) marked as paid.`,
      })
      setSelected([])
      setReference('')
    } catch (e) {
      setMessage({ tone: 'error', text: userMessage(e) })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-sm text-slate-600">Cash still owed to you</p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {formatMoney(overview.totalHeld)}
          </p>
        </Card>
        {overview.byHolder.map((h) => (
          <Card key={`${h.holderType}-${h.holderName}`} className="p-4">
            <p className="text-sm text-slate-600">
              Held by {h.holderName}
              {h.holderType === 'STAFF' ? ' (staff)' : ' (courier)'}
            </p>
            <p className="mt-1 text-xl font-bold text-slate-900">
              {formatMoney(h.amount)}
            </p>
            <p className="text-xs text-slate-500">{h.count} order(s)</p>
          </Card>
        ))}
      </div>

      <section aria-labelledby="held-heading" className="mt-8">
        <h2 id="held-heading" className="text-lg font-semibold text-slate-900">
          Not received yet
        </h2>
        {overview.held.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">
            Nothing outstanding: all cash has reached you.
          </p>
        ) : (
          <>
            <CollectionTable
              caption="Cash not received yet"
              rows={overview.held}
              selected={selected}
              onToggle={(id) =>
                setSelected((list) =>
                  list.includes(id)
                    ? list.filter((x) => x !== id)
                    : [...list, id],
                )
              }
            />
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <Input
                label="Reference (optional)"
                hint="e.g. the courier's remittance number or bank reference."
                value={reference}
                maxLength={60}
                onChange={(e) => setReference(e.target.value)}
              />
              <Button
                onClick={settle}
                isLoading={isSaving}
                disabled={selected.length === 0}
              >
                {selected.length === 0
                  ? 'Mark received'
                  : `Mark ${formatMoney(chosenAmount)} received`}
              </Button>
            </div>
          </>
        )}
        <StatusMessage message={message} className="mt-3" />
      </section>

      {overview.recentlyReceived.length > 0 && (
        <section aria-labelledby="received-heading" className="mt-10">
          <h2
            id="received-heading"
            className="text-lg font-semibold text-slate-900"
          >
            Recently received
          </h2>
          <CollectionTable
            caption="Cash recently received"
            rows={overview.recentlyReceived}
          />
        </section>
      )}
    </>
  )
}

function CollectionTable({
  caption,
  rows,
  selected,
  onToggle,
}: {
  caption: string
  rows: CodCollection[]
  selected?: string[]
  onToggle?: (id: string) => void
}) {
  return (
    <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
          <tr>
            {onToggle && (
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">Received</span>
              </th>
            )}
            <th scope="col" className="px-4 py-3 font-semibold">
              Order
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Held by
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              {onToggle ? 'Delivered' : 'Received'}
            </th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">
              Amount
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((c) => (
            <tr key={c.id}>
              {onToggle && (
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    className="size-5 accent-brand-700"
                    checked={selected?.includes(c.id) ?? false}
                    onChange={() => onToggle(c.id)}
                    aria-label={`Cash for ${c.orderNumber} received`}
                  />
                </td>
              )}
              <th scope="row" className="px-4 py-3 font-medium">
                <Link
                  to={`/admin/orders/${c.orderNumber}`}
                  className="text-brand-800 hover:underline"
                >
                  {c.orderNumber}
                </Link>
                <span className="block text-xs font-normal text-slate-500">
                  {c.reference}
                </span>
              </th>
              <td className="px-4 py-3">{c.holderName}</td>
              <td className="px-4 py-3">
                {onToggle ? (
                  <>
                    {formatDateTime(c.collectedAt)}
                    {c.daysHeld >= 3 && (
                      <span className="block text-xs font-semibold text-amber-800">
                        {c.daysHeld} days ago
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    {c.settledAt && formatDateTime(c.settledAt)}
                    {c.settlementReference && (
                      <span className="block text-xs text-slate-500">
                        {c.settlementReference}
                      </span>
                    )}
                  </>
                )}
              </td>
              <td className="px-4 py-3 text-right font-semibold">
                {formatMoney(c.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
