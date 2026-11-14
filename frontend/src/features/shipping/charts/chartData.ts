import type { ShippingSummary } from '../shippingApi'
import { TRACKING_STATUS_LABELS } from '../shippingApi'

export type Breakdown = { label: string; value: number; extra?: string }[]

/** "2026-11-14" → "14 Nov"; "2026-11" → "Nov 2026" */
export function periodLabel(period: string) {
  const [y, m, d] = period.split('-').map(Number)
  const date = new Date(y, m - 1, d ?? 1)
  return d
    ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

/** Shipments per tracking status, with readable names. */
export const statusRows = (summary: ShippingSummary): Breakdown =>
  summary.byStatus.map((s) => ({
    label: TRACKING_STATUS_LABELS[s.status],
    value: s.shipments,
  }))
