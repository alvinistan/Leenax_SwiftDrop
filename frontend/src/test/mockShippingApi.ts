import { http } from 'msw'
import type {
  AuditEntry,
  BoxPreset,
  CategoryPolicy,
  CourierProvider,
  MarkupRule,
  QuoteRequest,
  RateCard,
  RateCardInput,
  ShippingSettings,
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

/** Bodies of requests the pages sent, newest last. */
export const sent: {
  policies: { category: string; body: unknown }[]
  rateCards: RateCardInput[]
  markupRules: unknown[]
  settings: ShippingSettings[]
  quotes: QuoteRequest[]
} = { policies: [], rateCards: [], markupRules: [], settings: [], quotes: [] }

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
  simulatedQuote = undefined
  sent.policies = []
  sent.rateCards = []
  sent.markupRules = []
  sent.settings = []
  sent.quotes = []
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
]
