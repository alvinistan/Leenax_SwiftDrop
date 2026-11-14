import { Badge } from '../../components/ui/Badge'
import { TRACKING_STATUS_LABELS, type TrackingStatus } from './shippingApi'

const TONES: Record<
  TrackingStatus,
  'neutral' | 'brand' | 'success' | 'warning' | 'danger'
> = {
  BOOKED: 'neutral',
  LABEL_CREATED: 'neutral',
  PICKED_UP: 'brand',
  IN_TRANSIT: 'brand',
  CUSTOMS_CLEARANCE: 'warning',
  OUT_FOR_DELIVERY: 'brand',
  DELIVERED: 'success',
  EXCEPTION: 'danger',
  RETURNED: 'danger',
  CANCELLED: 'neutral',
}

export function TrackingStatusBadge({ status }: { status: TrackingStatus }) {
  return <Badge tone={TONES[status]}>{TRACKING_STATUS_LABELS[status]}</Badge>
}
