import { http } from 'msw'
import type { PricedCartLine } from '../features/cart/cartApi'
import type {
  AdminOrder,
  CustomerOrder,
  DeliveryQuote,
  OrderStatus,
  PlaceOrderInput,
} from '../features/orders/ordersApi'
import type { TaxRate } from '../features/tax/taxApi'
import { API, apiEmpty, apiJson } from './apiResponses'

/*
 * Fake shop endpoints for Phase 8: cart pricing, delivery quote, orders, tax
 * rates. resetMockShop() restores everything before each test.
 */

/** Products the fake cart knows (variantId → priced details for quantity 1). */
type ShopVariant = {
  variantId: string
  productName: string
  variantLabel: string
  price: string
  taxPercent: number
  codAllowed: boolean
  stock: number
}

let variants: ShopVariant[] = []
let orders: AdminOrder[] = []
let taxRates: TaxRate[] = []
let deliveryQuote: DeliveryQuote | undefined
let orderConflict: string | undefined

/** What the pages sent. */
export const shopSent: {
  orders: { body: PlaceOrderInput; key: string | null }[]
  quotes: unknown[]
  statusChanges: unknown[]
} = { orders: [], quotes: [], statusChanges: [] }

export function resetMockShop() {
  variants = []
  orders = []
  taxRates = []
  deliveryQuote = undefined
  orderConflict = undefined
  shopSent.orders = []
  shopSent.quotes = []
  shopSent.statusChanges = []
}

export function seedShopVariant(
  v: Partial<ShopVariant> & { variantId: string },
) {
  variants.push({
    productName: 'Milk toffee',
    variantLabel: '250 g',
    price: '1180.00',
    taxPercent: 18,
    codAllowed: true,
    stock: 10,
    ...v,
  })
}

export function setDeliveryQuote(quote: DeliveryQuote) {
  deliveryQuote = quote
}

/** The next order request fails with 409 and this message. */
export function failNextOrder(message: string) {
  orderConflict = message
}

export function seedTaxRates(rates: TaxRate[]) {
  taxRates = rates
}

export function seedAdminOrder(
  order: Partial<AdminOrder> & { orderNumber: string },
): AdminOrder {
  const full: AdminOrder = {
    customerEmail: 'kamala@example.com',
    customerName: 'Kamala',
    status: 'PLACED',
    allowedNextStatuses: ['CONFIRMED', 'CANCELLED'],
    paymentMethod: 'ARRANGE_LATER',
    paymentStatus: 'UNPAID',
    items: [],
    itemsTotal: { amount: '1180.00', currency: 'LKR' },
    taxIncluded: { amount: '180.00', currency: 'LKR' },
    grandTotal: { amount: '1741.00', currency: 'LKR' },
    shipping: {
      providerCode: 'DEX',
      providerName: 'DEX',
      serviceName: 'Standard',
      courierPrice: { amount: '550.00', currency: 'LKR' },
      platformFee: { amount: '11.00', currency: 'LKR' },
      customerPrice: { amount: '561.00', currency: 'LKR' },
      markupDescription: '2% (Default platform fee)',
      chargeableWeightKg: '2',
    },
    address: {
      recipientName: 'Kamala',
      phone: '+94 77 123 4567',
      line1: '12 Temple Road',
      line2: null,
      city: 'Jaffna',
      region: null,
      postalCode: '40000',
      countryCode: 'LK',
    },
    note: null,
    history: [
      {
        status: 'PLACED',
        note: 'Order placed',
        actor: 'kamala@example.com',
        at: '2026-11-14T08:00:00Z',
      },
    ],
    createdAt: '2026-11-14T08:00:00Z',
    shipments: [],
    ...order,
  }
  orders.push(full)
  return full
}

const money = (amount: number) => ({
  amount: amount.toFixed(2),
  currency: 'LKR',
})

function priceLine(variantId: string, quantity: string): PricedCartLine {
  const v = variants.find((x) => x.variantId === variantId)
  if (!v) {
    return {
      variantId,
      productName: null,
      productSlug: null,
      variantLabel: null,
      saleUnit: null,
      rules: null,
      quantity,
      unitPrice: null,
      lineTotal: null,
      taxIncluded: null,
      taxName: null,
      codAllowed: false,
      imageUrl: null,
      problem: 'This item is no longer available.',
    }
  }
  const total = Number(v.price) * Number(quantity)
  return {
    variantId,
    productName: v.productName,
    productSlug: 'milk-toffee',
    variantLabel: v.variantLabel,
    saleUnit: 'PIECE',
    rules: { min: '1', max: null, step: '1' },
    quantity,
    unitPrice: money(Number(v.price)),
    lineTotal: money(total),
    taxIncluded: money((total * v.taxPercent) / (100 + v.taxPercent)),
    taxName: v.taxPercent ? `VAT ${v.taxPercent}%` : null,
    codAllowed: v.codAllowed,
    imageUrl: null,
    problem:
      Number(quantity) > v.stock
        ? 'Only a smaller quantity is in stock.'
        : null,
  }
}

function toCustomer(o: AdminOrder): CustomerOrder {
  return {
    shipments: o.shipments,
    orderNumber: o.orderNumber,
    status: o.status,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    items: o.items,
    itemsTotal: o.itemsTotal,
    taxIncluded: o.taxIncluded,
    shippingPrice: o.shipping.customerPrice,
    grandTotal: o.grandTotal,
    deliveryProvider: o.shipping.providerName,
    deliveryService: o.shipping.serviceName,
    address: o.address,
    note: o.note,
    history: o.history.map((h) => ({ ...h, actor: null })),
    canCancel: o.status === 'PLACED',
    createdAt: o.createdAt,
  }
}

const NEXT: Record<OrderStatus, OrderStatus[]> = {
  PLACED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
}

const page = <T>(content: T[]) => ({
  content,
  page: 0,
  size: 20,
  totalElements: content.length,
  totalPages: 1,
})

export const shopHandlers = [
  http.post(`${API}/api/cart/price`, async ({ request }) => {
    const { items } = (await request.json()) as {
      items: { variantId: string; quantity: string }[]
    }
    const lines = items.map((i) => priceLine(i.variantId, i.quantity))
    const ok = lines.filter((l) => !l.problem)
    const sum = (pick: (l: PricedCartLine) => string | undefined) =>
      money(ok.reduce((acc, l) => acc + Number(pick(l) ?? 0), 0))
    return apiJson({
      lines,
      itemsTotal: sum((l) => l.lineTotal?.amount),
      taxIncluded: sum((l) => l.taxIncluded?.amount),
      orderable: lines.every((l) => !l.problem),
    })
  }),

  http.get(`${API}/api/shipping/destinations`, () =>
    apiJson([
      { code: 'CA', name: 'Canada' },
      { code: 'LK', name: 'Sri Lanka' },
      { code: 'GB', name: 'United Kingdom' },
    ]),
  ),

  http.post(`${API}/api/shipping/quotes`, async ({ request }) => {
    const body = (await request.json()) as { countryCode: string }
    shopSent.quotes.push(body)
    return apiJson(
      deliveryQuote ?? {
        quoteId: 'quote-1',
        destinationCountry: body.countryCode,
        domestic: body.countryCode === 'LK',
        dutiesPaidBy: 'RECEIVER',
        options:
          body.countryCode === 'LK'
            ? [
                {
                  optionId: 'opt-dex',
                  providerName: 'DEX',
                  serviceName: 'Standard',
                  price: money(561),
                },
              ]
            : [
                {
                  optionId: 'opt-dhl',
                  providerName: 'DHL Express',
                  serviceName: 'International',
                  price: money(9800),
                },
              ],
        problems: [],
        expiresAt: '2026-11-14T09:00:00Z',
      },
    )
  }),

  http.post(`${API}/api/orders`, async ({ request }) => {
    const body = (await request.json()) as PlaceOrderInput
    shopSent.orders.push({ body, key: request.headers.get('Idempotency-Key') })
    if (orderConflict) {
      const detail = orderConflict
      orderConflict = undefined
      return apiJson(
        { title: 'Conflict', status: 409, detail },
        { status: 409 },
      )
    }
    const lines = body.items.map((i) => priceLine(i.variantId, i.quantity))
    const items = lines.map((l) => ({
      variantId: l.variantId,
      productName: l.productName!,
      variantLabel: l.variantLabel!,
      sku: 'SKU',
      saleUnit: 'PIECE' as const,
      quantity: l.quantity,
      unitPrice: l.unitPrice!,
      lineTotal: l.lineTotal!,
      taxName: l.taxName,
      taxPercent: '18',
      taxIncluded: l.taxIncluded!,
    }))
    const order = seedAdminOrder({
      orderNumber: `SD-00${1001 + orders.length}`,
      paymentMethod: body.paymentMethod,
      items,
      address: body.address,
    })
    return apiJson(toCustomer(order), { status: 201 })
  }),

  http.get(`${API}/api/orders`, () =>
    apiJson(
      page(
        orders.map((o) => ({
          orderNumber: o.orderNumber,
          status: o.status,
          paymentMethod: o.paymentMethod,
          paymentStatus: o.paymentStatus,
          grandTotal: o.grandTotal,
          itemCount: o.items.length,
          recipientName: o.address.recipientName,
          countryCode: o.address.countryCode,
          createdAt: o.createdAt,
        })),
      ),
    ),
  ),

  http.get(`${API}/api/orders/:n`, ({ params }) => {
    const o = orders.find((x) => x.orderNumber === params.n)
    return o
      ? apiJson(toCustomer(o))
      : apiJson(
          { title: 'Not Found', status: 404, detail: 'Order not found' },
          { status: 404 },
        )
  }),

  http.post(`${API}/api/orders/:n/cancel`, ({ params }) => {
    const o = orders.find((x) => x.orderNumber === params.n)!
    Object.assign(o, { status: 'CANCELLED', allowedNextStatuses: [] })
    o.history = [
      ...o.history,
      {
        status: 'CANCELLED',
        note: 'Cancelled by the customer',
        actor: null,
        at: '2026-11-14T09:00:00Z',
      },
    ]
    return apiJson(toCustomer(o))
  }),

  http.get(`${API}/api/admin/orders`, () =>
    apiJson(
      page(
        orders.map((o) => ({
          orderNumber: o.orderNumber,
          status: o.status,
          paymentMethod: o.paymentMethod,
          paymentStatus: o.paymentStatus,
          grandTotal: o.grandTotal,
          itemCount: o.items.length,
          recipientName: o.address.recipientName,
          countryCode: o.address.countryCode,
          createdAt: o.createdAt,
        })),
      ),
    ),
  ),

  http.get(`${API}/api/admin/orders/:n`, ({ params }) =>
    apiJson(orders.find((x) => x.orderNumber === params.n)),
  ),

  http.post(
    `${API}/api/admin/orders/:n/status`,
    async ({ params, request }) => {
      const body = (await request.json()) as {
        status: OrderStatus
        note: string | null
      }
      shopSent.statusChanges.push(body)
      const o = orders.find((x) => x.orderNumber === params.n)!
      Object.assign(o, {
        status: body.status,
        allowedNextStatuses: NEXT[body.status],
      })
      o.history = [
        ...o.history,
        {
          status: body.status,
          note: body.note,
          actor: 'owner@example.com',
          at: '2026-11-14T10:00:00Z',
        },
      ]
      return apiJson(o)
    },
  ),

  http.post(`${API}/api/admin/orders/:n/payment`, ({ params }) => {
    const o = orders.find((x) => x.orderNumber === params.n)!
    o.paymentStatus = 'PAID'
    o.history = [
      ...o.history,
      {
        status: 'PAID',
        note: 'Payment received',
        actor: 'owner@example.com',
        at: '2026-11-14T10:00:00Z',
      },
    ]
    return apiJson(o)
  }),

  http.get(`${API}/api/admin/tax-rates`, () => apiJson(taxRates)),
  http.post(`${API}/api/admin/tax-rates`, async ({ request }) => {
    const body = (await request.json()) as { name: string; percent: string }
    const rate = { id: `tax-${taxRates.length + 1}`, ...body, productCount: 0 }
    taxRates = [...taxRates, rate]
    return apiJson(rate, { status: 201 })
  }),
  http.delete(`${API}/api/admin/tax-rates/:id`, () => apiEmpty(204)),
]
