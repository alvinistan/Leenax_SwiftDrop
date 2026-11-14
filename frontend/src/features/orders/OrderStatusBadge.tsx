import { Badge } from '../../components/ui/Badge'
import { ORDER_STATUS_LABELS, type OrderStatus } from './ordersApi'

const TONES = {
  PLACED: 'warning',
  CONFIRMED: 'brand',
  SHIPPED: 'brand',
  DELIVERED: 'success',
  CANCELLED: 'neutral',
} as const

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={TONES[status]}>{ORDER_STATUS_LABELS[status]}</Badge>
}
