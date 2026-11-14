import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { Button } from '../../../components/ui/Button'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { Select } from '../../../components/ui/Select'
import { KpiTiles } from '../../../features/shipping/charts/KpiTiles'
import { statusRows } from '../../../features/shipping/charts/chartData'
import {
  BreakdownChart,
  ChargedVsCostsChart,
  MarginChart,
} from '../../../features/shipping/charts/ShippingCharts'
import {
  getSummaryReport,
  type ReportGrouping,
} from '../../../features/shipping/shippingApi'
import { useCountries } from '../../../features/shipping/useCountriesPublic'
import { useAsync } from '../../../hooks/useAsync'
import { userMessage } from '../../../lib/errors'

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Shipping reports with charts. Filters in one row above the charts. */
export function ShippingReportsPage() {
  const [params, setParams] = useSearchParams()
  const [defaults] = useState(() => {
    const today = new Date()
    return {
      from: isoDate(new Date(today.getFullYear(), today.getMonth(), 1)),
      to: isoDate(today),
    }
  })
  const from = params.get('from') ?? defaults.from
  const to = params.get('to') ?? defaults.to
  const groupBy = (
    params.get('groupBy') === 'MONTH' ? 'MONTH' : 'DAY'
  ) as ReportGrouping
  const [draft, setDraft] = useState({ from, to, groupBy })
  const { nameOf } = useCountries()
  const { state, retry } = useAsync(
    (signal) => getSummaryReport(from, to, groupBy, signal),
    `summary-${from}-${to}-${groupBy}`,
  )

  function apply(event: FormEvent) {
    event.preventDefault()
    setParams({ from: draft.from, to: draft.to, groupBy: draft.groupBy })
  }

  return (
    <>
      <title>Reports | Shipping | Admin</title>
      <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
      <p className="mt-1 max-w-3xl text-sm text-slate-600">
        Shipments recorded in the period. The margin is delivery charged minus
        courier costs (gross, not net profit); parcels without a courier charge
        are left out of it.
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
        <div className="w-36">
          <Select
            label="Group by"
            value={draft.groupBy}
            onChange={(e) =>
              setDraft({ ...draft, groupBy: e.target.value as ReportGrouping })
            }
          >
            <option value="DAY">Day</option>
            <option value="MONTH">Month</option>
          </Select>
        </div>
        <Button type="submit" variant="secondary">
          Show
        </Button>
      </form>

      <div className="mt-6">
        {state.status === 'loading' && (
          <p className="text-slate-600">Loading report…</p>
        )}
        {state.status === 'error' && (
          <ErrorState description={userMessage(state.error)} onRetry={retry} />
        )}
        {state.status === 'success' && (
          <div className="space-y-6">
            <KpiTiles totals={state.data.totals} />
            <div className="grid gap-6 xl:grid-cols-2">
              <ChargedVsCostsChart series={state.data.series} />
              <MarginChart series={state.data.series} />
              <BreakdownChart
                title="Shipments by courier"
                unit="Shipments"
                rows={state.data.byCourier.map((c) => ({
                  label: c.providerName.replace(/ \(.*\)$/, ''),
                  value: c.shipments,
                  extra: c.courierCosts.amount,
                }))}
              />
              <BreakdownChart
                title="Shipments by destination"
                unit="Shipments"
                rows={state.data.byCountry.map((c) => ({
                  label: nameOf(c.countryCode),
                  value: c.shipments,
                }))}
              />
              <BreakdownChart
                title="Shipments by status"
                unit="Shipments"
                rows={statusRows(state.data)}
              />
            </div>
          </div>
        )}
      </div>
    </>
  )
}
