import { formatMoney } from '../../../lib/money'
import type { ShippingSummary } from '../shippingApi'

/** Headline numbers for a period. */
export function KpiTiles({ totals }: { totals: ShippingSummary['totals'] }) {
  const tiles = [
    {
      label: 'Shipments',
      value: String(totals.shipments),
      hint: `${totals.delivered} delivered · ${totals.returned} returned`,
    },
    {
      label: 'Delivery charged',
      value: formatMoney(totals.deliveryCharged),
      hint: totals.averageDeliveryCharged
        ? `Average ${formatMoney(totals.averageDeliveryCharged)} per order`
        : 'No website orders',
    },
    {
      label: 'Courier costs',
      value: formatMoney(totals.courierCosts),
      hint:
        totals.withoutCourierCost > 0
          ? `${totals.withoutCourierCost} without a courier charge yet`
          : 'All charges entered',
    },
    {
      label: 'Gross shipping margin',
      value: formatMoney(totals.grossMargin),
      hint: 'Not net profit',
    },
    {
      label: 'Average delivery time',
      value: totals.averageDaysToDeliver
        ? `${totals.averageDaysToDeliver} days`
        : '—',
      hint: 'From booking to delivery',
    },
  ]
  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {tiles.map((t) => (
        <div
          key={t.label}
          className="rounded-xl border border-slate-200 bg-white p-4"
        >
          <dt className="text-sm text-slate-600">{t.label}</dt>
          <dd className="mt-1 text-xl font-bold text-slate-900">{t.value}</dd>
          <dd className="mt-1 text-xs text-slate-500">{t.hint}</dd>
        </div>
      ))}
    </dl>
  )
}
