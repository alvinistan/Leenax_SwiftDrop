import { ExternalLink } from 'lucide-react'
import { formatDateTime } from '../shipping/dates'
import {
  TRACKING_STATUS_LABELS,
  type TrackingStatus,
} from '../shipping/shippingApi'
import { TrackingStatusBadge } from '../shipping/TrackingStatusBadge'
import type { OrderShipment } from './ordersApi'

/** The parcels of an order with their tracking steps (customer and admin views). */
export function OrderShipments({ shipments }: { shipments: OrderShipment[] }) {
  return (
    <ul className="space-y-4">
      {shipments.map((s) => (
        <li key={s.id} className="rounded-lg border border-slate-200 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-900">
              {s.providerName}
              {s.serviceName && ` · ${s.serviceName}`}
            </span>
            <TrackingStatusBadge status={s.status as TrackingStatus} />
          </div>
          <p className="mt-1 text-slate-700">
            Tracking number <span className="font-mono">{s.awb}</span>
          </p>
          {s.trackingUrl && (
            <a
              href={s.trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 flex w-fit items-center gap-1 font-semibold text-brand-800 hover:underline"
            >
              Track on {s.providerName}&apos;s website
              <ExternalLink className="size-3.5" aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          )}
          <ol
            className="mt-2 space-y-0.5 text-slate-600"
            aria-label={`Tracking steps for ${s.awb}`}
          >
            {[...s.steps].reverse().map((step, i) => (
              <li key={i}>
                {TRACKING_STATUS_LABELS[step.status as TrackingStatus] ??
                  step.status}
                {step.location && ` · ${step.location}`}
                <span className="text-slate-400">
                  {' '}
                  · {formatDateTime(step.at)}
                </span>
              </li>
            ))}
          </ol>
        </li>
      ))}
    </ul>
  )
}
