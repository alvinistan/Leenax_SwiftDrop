import { http } from 'msw'
import type {
  AuditEntry,
  BoxPreset,
  CategoryPolicy,
  CourierProvider,
  MarkupRule,
  ProductRestriction,
  QuoteRequest,
  RateCard,
  RateCardInput,
  ShipmentDetail,
  ShippingSettings,
  TrackingStatus,
  SimulatedQuote,
} from '../features/shipping/shippingApi'
import { API, apiEmpty, apiJson } from './apiResponses'

/*
 * Fake shipping admin endpoints (Shipping Phase C) with an in-memory state
 * that resetMockShipping() restores before each test. Requests are recorded
 * so tests can check exactly what the pages sent.
 */

const BASE = `${API}/api/admin/shipping`

export const DEX_SERVICE_ID = 'svc-dex-standard'

function initialSettings(): ShippingSettings {
  return {
    originLine1: 'Sillalai South',
    originLine2: 'Pandatharippu',
    originCity: 'Jaffna',
    originPostalCode: '40000',
    originCountry: 'LK',
    defaultPackagingKg: '0.25',
    dutiesPaidBy: 'RECEIVER',
  }
}

function initialProviders(): CourierProvider[] {
  return [
    {
      id: 'prov-dex',
      code: 'DEX',
      name: 'DEX',
      enabled: true,
      ratesSource: 'RATE_CARD',
      volumetricDivisor: null,
      weightRoundingIncrementKg: '1',
      rulesVerified: false,
      notes: null,
      trackingUrlTemplate: null,
      capabilities: ['MANUAL_BOOKING', 'MANUAL_TRACKING', 'RATE_CARD'],
      services: [
        {
          id: DEX_SERVICE_ID,
          code: 'STANDARD',
          name: 'DEX standard delivery (Sri Lanka)',
          scope: 'DOMESTIC',
          enabled: true,
        },
      ],
    },
    {
      id: 'prov-dhl',
      code: 'DHL_EXPRESS',
      name: 'DHL Express',
      enabled: false,
      ratesSource: 'API',
      volumetricDivisor: 5000,
      weightRoundingIncrementKg: '0.5',
      rulesVerified: false,
      notes: null,
      trackingUrlTemplate: null,
      capabilities: ['MANUAL_BOOKING', 'MANUAL_TRACKING'],
      services: [
        {
          id: 'svc-dhl-intl',
          code: 'INTERNATIONAL',
          name: 'DHL Express international',
          scope: 'INTERNATIONAL',
          enabled: true,
        },
      ],
    },
  ]
}

function initialPolicies(): CategoryPolicy[] {
  return [
    { category: 'GENERAL', internationalAllowed: true, blockedCountries: [] },
    {
      category: 'FOOD_SHELF_STABLE',
      internationalAllowed: true,
      blockedCountries: [],
    },
    {
      category: 'FOOD_PERISHABLE',
      internationalAllowed: false,
      blockedCountries: [],
    },
    { category: 'FRAGILE', internationalAllowed: true, blockedCountries: [] },
  ]
}

function initialRules(): MarkupRule[] {
  return [
    {
      id: 'rule-default',
      name: 'Default platform fee',
      type: 'PERCENT',
      percent: '2',
      fixedAmount: null,
      minFee: null,
      maxFee: null,
      providerId: null,
      countryCode: null,
      effectiveFrom: '2026-01-01T00:00:00Z',
      effectiveTo: null,
      enabled: true,
      priority: 0,
      activeNow: true,
      description: '2% (Default platform fee)',
    },
  ]
}

function initialBoxes(): BoxPreset[] {
  return [
    {
      id: 'box-small',
      name: 'Small (example)',
      lengthCm: '20',
      widthCm: '15',
      heightCm: '10',
      emptyWeightKg: '0.2',
      maxWeightKg: '3',
      enabled: true,
    },
  ]
}

export const COUNTRIES = [
  { code: 'AU', name: 'Australia' },
  { code: 'AT', name: 'Austria' },
  { code: 'CA', name: 'Canada' },
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'GB', name: 'United Kingdom' },
]

let settings = initialSettings()
let providers = initialProviders()
let policies = initialPolicies()
let rules = initialRules()
let boxes = initialBoxes()
let cards: RateCard[] = []
let audit: AuditEntry[] = []
let productRestrictions: ProductRestriction[] = []
let destinations = ['CA', 'GB', 'LK']
let shipments: ShipmentDetail[] = []

/** Same steps as the server's TrackingStatus.allowedNext(). */
const NEXT: Record<TrackingStatus, TrackingStatus[]> = {
  BOOKED: ['BOOKED', 'LABEL_CREATED', 'PICKED_UP', 'EXCEPTION', 'CANCELLED'],
  LABEL_CREATED: ['LABEL_CREATED', 'PICKED_UP', 'EXCEPTION', 'CANCELLED'],
  PICKED_UP: [
    'IN_TRANSIT',
    'CUSTOMS_CLEARANCE',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'EXCEPTION',
    'RETURNED',
  ],
  IN_TRANSIT: [
    'IN_TRANSIT',
    'CUSTOMS_CLEARANCE',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'EXCEPTION',
    'RETURNED',
  ],
  CUSTOMS_CLEARANCE: [
    'IN_TRANSIT',
    'CUSTOMS_CLEARANCE',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'EXCEPTION',
    'RETURNED',
  ],
  OUT_FOR_DELIVERY: [
    'IN_TRANSIT',
    'CUSTOMS_CLEARANCE',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'EXCEPTION',
    'RETURNED',
  ],
  EXCEPTION: [
    'IN_TRANSIT',
    'CUSTOMS_CLEARANCE',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'EXCEPTION',
    'RETURNED',
  ],
  DELIVERED: [],
  RETURNED: [],
  CANCELLED: [],
}

/** Adds a shipment as the server would store it; returns it. */
export function seedShipment(
  overrides: Partial<ShipmentDetail> = {},
): ShipmentDetail {
  const shipment: ShipmentDetail = {
    id: `ship-${shipments.length + 1}`,
    providerId: 'prov-dex',
    providerCode: 'DEX',
    providerName: 'DEX',
    serviceId: null,
    serviceName: null,
    orderReference: 'WA-1001',
    awb: 'DEX12345',
    destinationCountry: 'LK',
    destinationCity: 'Colombo',
    weightKg: '1.4',
    courierCost: null,
    status: 'BOOKED',
    bookingMethod: 'MANUAL',
    trackingUrl: null,
    allowedNextStatuses: NEXT.BOOKED,
    manualTracking: true,
    events: [
      {
        id: 'ev-1',
        status: 'BOOKED',
        occurredAt: '2026-11-14T08:00:00Z',
        location: null,
        note: "Booked on the courier's portal",
        source: 'MANUAL',
        recordedBy: 'owner@example.com',
      },
    ],
    createdBy: 'owner@example.com',
    createdAt: '2026-11-14T08:00:00Z',
    ...overrides,
  }
  shipments = [...shipments, shipment]
  return shipment
}

export function seedProductRestrictions(list: ProductRestriction[]) {
  productRestrictions = list
}

/** Bodies of requests the pages sent, newest last. */
export const sent: {
  policies: { category: string; body: unknown }[]
  rateCards: RateCardInput[]
  markupRules: unknown[]
  settings: ShippingSettings[]
  quotes: QuoteRequest[]
  shipments: unknown[]
  tracking: unknown[]
  destinations: string[][]
} = {
  policies: [],
  rateCards: [],
  markupRules: [],
  settings: [],
  quotes: [],
  shipments: [],
  tracking: [],
  destinations: [],
}

/** What the simulator endpoint answers (tests may replace it). */
export let simulatedQuote: SimulatedQuote | undefined

export function setSimulatedQuote(quote: SimulatedQuote) {
  simulatedQuote = quote
}

export function seedAudit(entries: AuditEntry[]) {
  audit = entries
}

export function resetMockShipping() {
  settings = initialSettings()
  providers = initialProviders()
  policies = initialPolicies()
  rules = initialRules()
  boxes = initialBoxes()
  cards = []
  audit = []
  productRestrictions = []
  destinations = ['CA', 'GB', 'LK']
  shipments = []
  simulatedQuote = undefined
  sent.policies = []
  sent.rateCards = []
  sent.markupRules = []
  sent.settings = []
  sent.quotes = []
  sent.shipments = []
  sent.tracking = []
  sent.destinations = []
}

const validation = (field: string, message: string) =>
  apiJson(
    {
      title: 'Bad Request',
      status: 400,
      detail: 'Validation failed',
      errors: [{ field, message }],
    },
    { status: 400 },
  )

export const shippingHandlers = [
  http.get(`${BASE}/settings`, () => apiJson(settings)),
  http.put(`${BASE}/settings`, async ({ request }) => {
    const body = (await request.json()) as ShippingSettings
    sent.settings.push(body)
    settings = body
    return apiJson(settings)
  }),
  http.get(`${BASE}/countries`, () => apiJson(COUNTRIES)),
  http.get(`${BASE}/destinations`, () => apiJson(destinations)),
  http.put(`${BASE}/destinations`, async ({ request }) => {
    const body = (await request.json()) as { countryCodes: string[] }
    sent.destinations.push(body.countryCodes)
    destinations = ['LK', ...body.countryCodes].sort()
    return apiJson(destinations)
  }),
  http.get(`${BASE}/product-restrictions`, () => apiJson(productRestrictions)),
  http.get(`${BASE}/providers`, () => apiJson(providers)),
  http.put(`${BASE}/providers/:id`, async ({ params, request }) => {
    const body = (await request.json()) as CourierProvider
    providers = providers.map((p) =>
      p.id === params.id
        ? {
            ...p,
            ...body,
            services: p.services.map((s) => ({
              ...s,
              enabled:
                (body.services as { id: string; enabled: boolean }[]).find(
                  (t) => t.id === s.id,
                )?.enabled ?? s.enabled,
            })),
          }
        : p,
    )
    return apiJson(providers.find((p) => p.id === params.id))
  }),
  http.get(`${BASE}/presets`, () => apiJson(boxes)),
  http.post(`${BASE}/presets`, async ({ request }) => {
    const box = {
      id: `box-${boxes.length + 1}`,
      ...((await request.json()) as Omit<BoxPreset, 'id'>),
    }
    boxes = [...boxes, box]
    return apiJson(box, { status: 201 })
  }),
  http.get(`${BASE}/category-policies`, () => apiJson(policies)),
  http.put(
    `${BASE}/category-policies/:category`,
    async ({ params, request }) => {
      const body = (await request.json()) as Omit<CategoryPolicy, 'category'>
      sent.policies.push({ category: String(params.category), body })
      if (body.blockedCountries.some((c) => c === 'ZZ')) {
        return validation('blockedCountries', 'Unknown country code: ZZ')
      }
      const updated = { category: params.category, ...body } as CategoryPolicy
      policies = policies.map((p) =>
        p.category === params.category ? updated : p,
      )
      return apiJson(updated)
    },
  ),
  http.get(`${BASE}/markup-rules`, () => apiJson(rules)),
  http.post(`${BASE}/markup-rules`, async ({ request }) => {
    const body = (await request.json()) as MarkupRule
    sent.markupRules.push(body)
    const rule: MarkupRule = {
      ...body,
      id: `rule-${rules.length + 1}`,
      effectiveFrom: body.effectiveFrom ?? '2026-11-14T00:00:00Z',
      activeNow: body.enabled,
      description: `${body.name}`,
    }
    rules = [...rules, rule]
    return apiJson(rule, { status: 201 })
  }),
  http.get(`${BASE}/rate-cards`, () => apiJson(cards)),
  http.post(`${BASE}/rate-cards`, async ({ request }) => {
    const body = (await request.json()) as RateCardInput
    sent.rateCards.push(body)
    const card: RateCard = {
      ...body,
      id: `card-${cards.length + 1}`,
      providerCode: 'DEX',
      providerName: 'DEX',
      serviceName: 'DEX standard delivery (Sri Lanka)',
      scope: 'DOMESTIC',
      currency: 'LKR',
    }
    cards = [...cards, card]
    return apiJson(card, { status: 201 })
  }),
  http.delete(`${BASE}/rate-cards/:id`, ({ params }) => {
    cards = cards.filter((c) => c.id !== params.id)
    return apiEmpty(204)
  }),
  http.post(`${BASE}/quotes/simulate`, async ({ request }) => {
    sent.quotes.push((await request.json()) as QuoteRequest)
    return apiJson(simulatedQuote)
  }),
  http.get(`${BASE}/audit`, ({ request }) => {
    const type = new URL(request.url).searchParams.get('entityType')
    const content = type ? audit.filter((a) => a.entityType === type) : audit
    return apiJson({
      content,
      page: 0,
      size: 20,
      totalElements: content.length,
      totalPages: 1,
    })
  }),
  http.get(`${BASE}/shipments`, ({ request }) => {
    const url = new URL(request.url)
    const q = url.searchParams.get('q')?.toLowerCase()
    const status = url.searchParams.get('status')
    const content = shipments
      .filter((sh) => !status || sh.status === status)
      .filter(
        (sh) =>
          !q ||
          sh.awb.toLowerCase().includes(q) ||
          sh.orderReference.toLowerCase().includes(q),
      )
      .map((sh) => ({ ...sh, updatedAt: sh.createdAt }))
    return apiJson({
      content,
      page: 0,
      size: 20,
      totalElements: content.length,
      totalPages: 1,
    })
  }),
  http.get(`${BASE}/shipments/:id`, ({ params }) => {
    const found = shipments.find((sh) => sh.id === params.id)
    return found
      ? apiJson(found)
      : apiJson(
          { title: 'Not Found', status: 404, detail: 'Shipment not found' },
          { status: 404 },
        )
  }),
  http.post(`${BASE}/shipments`, async ({ request }) => {
    const body = (await request.json()) as {
      providerId: string
      details: {
        awb: string
        orderReference: string
        destinationCountry: string
      }
    }
    sent.shipments.push(body)
    const awb = body.details.awb.toUpperCase()
    if (shipments.some((sh) => sh.awb === awb)) {
      return apiJson(
        {
          title: 'Conflict',
          status: 409,
          detail: 'This DEX tracking number is already recorded.',
        },
        { status: 409 },
      )
    }
    const { courierCost, ...details } = body.details as typeof body.details & {
      courierCost: string | null
    }
    const created = seedShipment({
      ...details,
      courierCost: courierCost
        ? { amount: Number(courierCost).toFixed(2), currency: 'LKR' }
        : null,
      awb,
      providerId: body.providerId,
    } as Partial<ShipmentDetail>)
    return apiJson(created, { status: 201 })
  }),
  http.post(`${BASE}/shipments/:id/tracking`, async ({ params, request }) => {
    const body = (await request.json()) as {
      status: TrackingStatus
      location: string | null
      note: string | null
    }
    sent.tracking.push(body)
    const shipment = shipments.find((sh) => sh.id === params.id)!
    const updated: ShipmentDetail = {
      ...shipment,
      status: body.status,
      allowedNextStatuses: NEXT[body.status],
      events: [
        ...shipment.events,
        {
          id: `ev-${shipment.events.length + 1}`,
          status: body.status,
          occurredAt: '2026-11-14T10:00:00Z',
          location: body.location,
          note: body.note,
          source: 'MANUAL',
          recordedBy: 'owner@example.com',
        },
      ],
    }
    shipments = shipments.map((sh) => (sh.id === updated.id ? updated : sh))
    return apiJson(updated)
  }),
]
