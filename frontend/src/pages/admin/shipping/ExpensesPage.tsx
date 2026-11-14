import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { getExpensesReport } from '../../../features/shipping/shippingApi'
import { useAsync } from '../../../hooks/useAsync'
import { userMessage } from '../../../lib/errors'
import { formatMoney } from '../../../lib/money'

/** "YYYY-MM-DD" in the browser's local time (the owner is in Sri Lanka). */
function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Courier costs vs delivery charged to customers, per period. The difference
 * is the GROSS shipping margin, not net profit.
 */
export function ExpensesPage() {
  const [params, setParams] = useSearchParams()
  // Default period: this month so far (the clock is read once).
  const [defaults] = useState(() => {
    const today = new Date()
    return {
      from: isoDate(new Date(today.getFullYear(), today.getMonth(), 1)),
      to: isoDate(today),
    }
  })
  const from = params.get('from') ?? defaults.from
  const to = params.get('to') ?? defaults.to
  const [draft, setDraft] = useState({ from, to })
  const { state, retry } = useAsync(
    (signal) => getExpensesReport(from, to, signal),
    `expenses-${from}-${to}`,
  )

  function apply(event: FormEvent) {
    event.preventDefault()
    setParams({ from: draft.from, to: draft.to })
  }

  return (
    <>
      <title>Courier expenses | Shipping | Admin</title>
      <h1 className="text-2xl font-bold text-slate-900">Courier expenses</h1>
      <p className="mt-1 max-w-3xl text-sm text-slate-600">
        Shipments recorded in the period: what customers paid for delivery, what
        the couriers charged, and the difference. This is the{' '}
        <strong>gross shipping margin, not net profit</strong>: packing, payment
        fees, time and losses are not included.
      </p>
      <form onSubmit={apply} className="mt-6 flex flex-wrap items-end gap-3">
        <Input
          type="date"
          label="From"
          value={draft.from}
          onChange={(e) => setDraft({ ...draft, from: e.target.value })}
        />
        <Input
          type="date"
          label="To"
          value={draft.to}
          onChange={(e) => setDraft({ ...draft, to: e.target.value })}
        />
        <Button type="submit" variant="secondary">
          Show
        </Button>
      </form>

      <div className="mt-6">
        {state.status === 'loading' && (
          <p className="text-slate-600">Loading…</p>
        )}
        {state.status === 'error' && (
          <ErrorState description={userMessage(state.error)} onRetry={retry} />
        )}
        {state.status === 'success' && (
          <>
            <div className="grid gap-4 sm:grid-cols-4">
              <Total
                label="Shipments"
                value={String(state.data.shipmentCount)}
              />
              <Total
                label="Delivery charged"
                value={formatMoney(state.data.deliveryCharged)}
              />
              <Total
                label="Courier costs"
                value={formatMoney(state.data.courierCosts)}
              />
              <Total
                label="Gross shipping margin"
                value={formatMoney(state.data.grossMargin)}
                hint="Only parcels with both a delivery charge and a courier cost."
              />
            </div>
            {state.data.shipmentsWithoutCourierCost > 0 && (
              <p
                role="status"
                className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
              >
                {state.data.shipmentsWithoutCourierCost} shipment(s) have no
                courier charge yet, so the totals are incomplete. Enter the
                charge on each shipment.
              </p>
            )}
            {state.data.rows.length > 0 && (
              <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Shipments in the period</caption>
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-semibold">
                        Shipment
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-right font-semibold"
                      >
                        Delivery charged
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-right font-semibold"
                      >
                        Courier base
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-right font-semibold"
                      >
                        Extra charges
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-right font-semibold"
                      >
                        Margin
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {state.data.rows.map((r) => (
                      <tr key={r.shipmentId}>
                        <th scope="row" className="px-4 py-3 font-medium">
                          <Link
                            to={`/admin/shipping/shipments/${r.shipmentId}`}
                            className="text-brand-800 hover:underline"
                          >
                            {r.orderReference}
                          </Link>
                          <span className="block text-xs font-normal text-slate-500">
                            {r.providerName} · {r.awb}
                          </span>
                        </th>
                        <td className="px-4 py-3 text-right">
                          {r.deliveryCharged
                            ? formatMoney(r.deliveryCharged)
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {r.courierBase
                            ? formatMoney(r.courierBase)
                            : 'Not entered'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {formatMoney(r.extraCharges)}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-semibold ${r.margin && r.margin.amount.startsWith('-') ? 'text-red-700' : ''}`}
                        >
                          {r.margin ? formatMoney(r.margin) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}

function Total({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <Card className="p-4">
      <p className="text-sm text-slate-600">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </Card>
  )
}
