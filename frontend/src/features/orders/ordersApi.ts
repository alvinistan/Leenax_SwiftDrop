import { http } from '../../api/http'
import type { Money, Page, SaleUnit } from '../../types/catalog'
import type { CartItem } from '../cart/cartStorage'

export type OrderStatus =
  'PLACED' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'
export type PaymentMethod = 'COD' | 'ARRANGE_LATER'
export type PaymentStatus = 'UNPAID' | 'PAID'

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PLACED: 'Placed',
  CONFIRMED: 'Confirmed',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  COD: 'Cash on delivery',
  ARRANGE_LATER: 'We will contact you to arrange payment',
}

export type Address = {
  recipientName: string
  phone: string
  line1: string
  line2: string | null
  city: string
  region: string | null
  postalCode: string | null
  countryCode: string
}

export type OrderItem = {
  variantId: string
  productName: string
  variantLabel: string
  sku: string
  saleUnit: SaleUnit
  quantity: string
  unitPrice: Money
  lineTotal: Money
  taxName: string | null
  taxPercent: string
  taxIncluded: Money
}

export type HistoryEntry = {
  status: string
  note: string | null
  actor: string | null
  at: string
}

export type CustomerOrder = {
  orderNumber: string
  status: OrderStatus
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  items: OrderItem[]
  itemsTotal: Money
  taxIncluded: Money
  shippingPrice: Money
  grandTotal: Money
  deliveryProvider: string
  deliveryService: string
  address: Address
  note: string | null
  history: HistoryEntry[]
  canCancel: boolean
  createdAt: string
}

export type OrderSummary = {
  orderNumber: string
  status: OrderStatus
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  grandTotal: Money
  itemCount: number
  recipientName: string
  countryCode: string
  createdAt: string
}

export type PlaceOrderInput = {
  items: CartItem[]
  address: Address
  quoteOptionId: string
  paymentMethod: PaymentMethod
  note: string | null
}

/**
 * The idempotency key is created ONCE per checkout: if the request is sent
 * twice (double click, retry after a timeout) the server returns the same order.
 */
export async function placeOrder(
  input: PlaceOrderInput,
  idempotencyKey: string,
) {
  return (
    await http.post<CustomerOrder>('/api/orders', input, {
      headers: { 'Idempotency-Key': idempotencyKey },
    })
  ).data
}

export async function listMyOrders(page: number, signal?: AbortSignal) {
  return (
    await http.get<Page<OrderSummary>>('/api/orders', {
      params: { page, size: 10 },
      signal,
    })
  ).data
}

export async function getMyOrder(orderNumber: string, signal?: AbortSignal) {
  return (
    await http.get<CustomerOrder>(
      `/api/orders/${encodeURIComponent(orderNumber)}`,
      { signal },
    )
  ).data
}

export async function cancelMyOrder(orderNumber: string) {
  return (
    await http.post<CustomerOrder>(
      `/api/orders/${encodeURIComponent(orderNumber)}/cancel`,
    )
  ).data
}

// ---- public helpers for checkout ----

export type Country = { code: string; name: string }

export async function listDestinations(signal?: AbortSignal) {
  return (await http.get<Country[]>('/api/shipping/destinations', { signal }))
    .data
}

export type DeliveryOption = {
  optionId: string
  providerName: string
  serviceName: string
  price: Money
}

export type DeliveryQuote = {
  quoteId: string | null
  destinationCountry: string
  domestic: boolean
  dutiesPaidBy: 'RECEIVER' | 'SENDER'
  options: DeliveryOption[]
  problems: string[]
  expiresAt: string | null
}

export async function getDeliveryQuote(input: {
  countryCode: string
  postalCode?: string
  items: CartItem[]
}) {
  return (await http.post<DeliveryQuote>('/api/shipping/quotes', input)).data
}

// ---- admin ----

export type AdminOrder = Omit<
  CustomerOrder,
  'canCancel' | 'deliveryProvider' | 'deliveryService' | 'shippingPrice'
> & {
  customerEmail: string | null
  customerName: string | null
  allowedNextStatuses: OrderStatus[]
  shipping: {
    providerCode: string
    providerName: string
    serviceName: string
    courierPrice: Money
    platformFee: Money
    customerPrice: Money
    markupDescription: string
    chargeableWeightKg: string
  }
}

export async function adminListOrders(
  query: { q?: string; status?: OrderStatus; page?: number },
  signal?: AbortSignal,
) {
  const { q, status, page = 0 } = query
  return (
    await http.get<Page<OrderSummary>>('/api/admin/orders', {
      params: {
        q: q || undefined,
        status: status || undefined,
        page,
        size: 20,
      },
      signal,
    })
  ).data
}

export async function adminGetOrder(orderNumber: string, signal?: AbortSignal) {
  return (
    await http.get<AdminOrder>(
      `/api/admin/orders/${encodeURIComponent(orderNumber)}`,
      { signal },
    )
  ).data
}

export async function adminChangeStatus(
  orderNumber: string,
  status: OrderStatus,
  note: string | null,
) {
  return (
    await http.post<AdminOrder>(
      `/api/admin/orders/${encodeURIComponent(orderNumber)}/status`,
      { status, note },
    )
  ).data
}

export async function adminMarkPaid(orderNumber: string, note: string | null) {
  return (
    await http.post<AdminOrder>(
      `/api/admin/orders/${encodeURIComponent(orderNumber)}/payment`,
      { note },
    )
  ).data
}
