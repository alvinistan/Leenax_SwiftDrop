import { http } from '../../api/http'
import type { Money, Page } from '../../types/catalog'
import type { ShippingCategory } from '../admin/adminProductApi'

/*
 * Shipping administration API (Shipping Phase C). Decimals arrive and leave
 * as STRINGS ("1.4", "550") so nothing is rounded by JavaScript.
 */

const BASE = '/api/admin/shipping'

export type DutiesPaidBy = 'RECEIVER' | 'SENDER'
export type RatesSource = 'API' | 'RATE_CARD'
export type ServiceScope = 'DOMESTIC' | 'INTERNATIONAL'
export type MarkupType = 'PERCENT' | 'FIXED' | 'COMBINED'

export type Country = { code: string; name: string }

export type ShippingSettings = {
  originLine1: string
  originLine2: string | null
  originCity: string
  originPostalCode: string | null
  originCountry: string
  defaultPackagingKg: string
  dutiesPaidBy: DutiesPaidBy
}

export type CourierService = {
  id: string
  code: string
  name: string
  scope: ServiceScope
  enabled: boolean
}

export type CourierProvider = {
  id: string
  code: string
  name: string
  enabled: boolean
  ratesSource: RatesSource
  volumetricDivisor: number | null
  weightRoundingIncrementKg: string
  rulesVerified: boolean
  notes: string | null
  services: CourierService[]
  /** "Track on the courier's website" link format with {awb}, or null. */
  trackingUrlTemplate: string | null
  /** What SwiftDrop can do with this courier. */
  capabilities: ProviderCapability[]
}

export type ProviderCapability =
  | 'RATE_CARD'
  | 'LIVE_RATES'
  | 'MANUAL_BOOKING'
  | 'MANUAL_TRACKING'
  | 'TRACKING_LINK'

export type ProviderInput = Omit<
  CourierProvider,
  'id' | 'code' | 'name' | 'services' | 'capabilities'
> & { services: { id: string; enabled: boolean }[] }

export type BoxPreset = {
  id: string
  name: string
  lengthCm: string
  widthCm: string
  heightCm: string
  emptyWeightKg: string
  maxWeightKg: string | null
  enabled: boolean
}

export type BoxPresetInput = Omit<BoxPreset, 'id'>

export type CategoryPolicy = {
  category: ShippingCategory
  internationalAllowed: boolean
  blockedCountries: string[]
}

export type MarkupRule = {
  id: string
  name: string
  type: MarkupType
  percent: string | null
  fixedAmount: string | null
  minFee: string | null
  maxFee: string | null
  providerId: string | null
  countryCode: string | null
  effectiveFrom: string
  effectiveTo: string | null
  enabled: boolean
  priority: number
  activeNow: boolean
  description: string
}

export type MarkupRuleInput = Omit<
  MarkupRule,
  'id' | 'activeNow' | 'description' | 'effectiveFrom'
> & { effectiveFrom: string | null }

export type RateBand = { maxWeightKg: string; price: string }

export type RateCard = {
  id: string
  serviceId: string
  providerCode: string
  providerName: string
  serviceName: string
  scope: ServiceScope
  countryCode: string
  currency: string
  enabled: boolean
  bands: RateBand[]
}

export type RateCardInput = {
  serviceId: string
  countryCode: string
  enabled: boolean
  bands: RateBand[]
}

export type QuoteRequest = {
  countryCode: string
  postalCode?: string
  items: { variantId: string; quantity: string }[]
}

export type QuoteOption = {
  serviceId: string
  providerCode: string
  providerName: string
  serviceName: string
  scope: ServiceScope
  available: boolean
  unavailableReason: string | null
  volumetricWeightKg: string | null
  chargeableWeightKg: string | null
  courierPrice: Money | null
  platformFee: Money | null
  customerPrice: Money | null
  markupRuleId: string | null
  markupDescription: string | null
}

export type SimulatedQuote = {
  destinationCountry: string
  domestic: boolean
  dutiesPaidBy: DutiesPaidBy
  items: {
    variantId: string
    productName: string
    sku: string
    shippingCategory: ShippingCategory
    quantity: string
    unitWeightKg: string | null
    problem: string | null
  }[]
  parcel: {
    itemsWeightKg: string
    packagingKg: string
    actualWeightKg: string
    boxName: string | null
    lengthCm: string | null
    widthCm: string | null
    heightCm: string | null
    fits: boolean
  } | null
  problems: string[]
  warnings: string[]
  options: QuoteOption[]
}

export type AuditEntry = {
  id: string
  entityType: string
  entityId: string
  action: 'CREATE' | 'UPDATE' | 'DELETE'
  actor: string
  beforeJson: string | null
  afterJson: string | null
  createdAt: string
}

const id = (value: string) => encodeURIComponent(value)

// ---- settings and countries ----

export async function getSettings(signal?: AbortSignal) {
  return (await http.get<ShippingSettings>(`${BASE}/settings`, { signal })).data
}

export async function updateSettings(input: ShippingSettings) {
  return (await http.put<ShippingSettings>(`${BASE}/settings`, input)).data
}

export async function listCountries(signal?: AbortSignal) {
  return (await http.get<Country[]>(`${BASE}/countries`, { signal })).data
}

/** Countries we deliver to (the origin country is always included). */
export async function getDestinations(signal?: AbortSignal) {
  return (await http.get<string[]>(`${BASE}/destinations`, { signal })).data
}

export async function updateDestinations(countryCodes: string[]) {
  return (await http.put<string[]>(`${BASE}/destinations`, { countryCodes }))
    .data
}

// ---- couriers ----

export async function listProviders(signal?: AbortSignal) {
  return (await http.get<CourierProvider[]>(`${BASE}/providers`, { signal }))
    .data
}

export async function updateProvider(providerId: string, input: ProviderInput) {
  return (
    await http.put<CourierProvider>(
      `${BASE}/providers/${id(providerId)}`,
      input,
    )
  ).data
}

// ---- boxes ----

export async function listPresets(signal?: AbortSignal) {
  return (await http.get<BoxPreset[]>(`${BASE}/presets`, { signal })).data
}

export async function createPreset(input: BoxPresetInput) {
  return (await http.post<BoxPreset>(`${BASE}/presets`, input)).data
}

export async function updatePreset(presetId: string, input: BoxPresetInput) {
  return (await http.put<BoxPreset>(`${BASE}/presets/${id(presetId)}`, input))
    .data
}

export async function deletePreset(presetId: string) {
  await http.delete(`${BASE}/presets/${id(presetId)}`)
}

// ---- country restrictions ----

export async function listCategoryPolicies(signal?: AbortSignal) {
  return (
    await http.get<CategoryPolicy[]>(`${BASE}/category-policies`, { signal })
  ).data
}

export async function updateCategoryPolicy(
  category: ShippingCategory,
  input: Omit<CategoryPolicy, 'category'>,
) {
  return (
    await http.put<CategoryPolicy>(
      `${BASE}/category-policies/${id(category)}`,
      input,
    )
  ).data
}

/** A product with its own restrictions, on top of its category's (set in the product form). */
export type ProductRestriction = {
  productId: string
  productName: string
  category: ShippingCategory
  domesticOnly: boolean
  blockedCountries: string[]
}

export async function listProductRestrictions(signal?: AbortSignal) {
  return (
    await http.get<ProductRestriction[]>(`${BASE}/product-restrictions`, {
      signal,
    })
  ).data
}

// ---- platform fee ----

export async function listMarkupRules(signal?: AbortSignal) {
  return (await http.get<MarkupRule[]>(`${BASE}/markup-rules`, { signal })).data
}

export async function createMarkupRule(input: MarkupRuleInput) {
  return (await http.post<MarkupRule>(`${BASE}/markup-rules`, input)).data
}

export async function updateMarkupRule(ruleId: string, input: MarkupRuleInput) {
  return (
    await http.put<MarkupRule>(`${BASE}/markup-rules/${id(ruleId)}`, input)
  ).data
}

export async function deleteMarkupRule(ruleId: string) {
  await http.delete(`${BASE}/markup-rules/${id(ruleId)}`)
}

// ---- rate cards ----

export async function listRateCards(signal?: AbortSignal) {
  return (await http.get<RateCard[]>(`${BASE}/rate-cards`, { signal })).data
}

export async function getRateCard(cardId: string, signal?: AbortSignal) {
  return (
    await http.get<RateCard>(`${BASE}/rate-cards/${id(cardId)}`, { signal })
  ).data
}

export async function createRateCard(input: RateCardInput) {
  return (await http.post<RateCard>(`${BASE}/rate-cards`, input)).data
}

export async function updateRateCard(cardId: string, input: RateCardInput) {
  return (await http.put<RateCard>(`${BASE}/rate-cards/${id(cardId)}`, input))
    .data
}

export async function deleteRateCard(cardId: string) {
  await http.delete(`${BASE}/rate-cards/${id(cardId)}`)
}

// ---- simulator and history ----

export async function simulateQuote(input: QuoteRequest) {
  return (await http.post<SimulatedQuote>(`${BASE}/quotes/simulate`, input))
    .data
}

export async function listAudit(
  query: { page?: number; size?: number; entityType?: string },
  signal?: AbortSignal,
) {
  const { page = 0, size = 20, entityType } = query
  return (
    await http.get<Page<AuditEntry>>(`${BASE}/audit`, {
      params: { page, size, entityType: entityType || undefined },
      signal,
    })
  ).data
}

// ---- shipments (manual booking and tracking) ----

export type TrackingStatus =
  | 'BOOKED'
  | 'LABEL_CREATED'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'CUSTOMS_CLEARANCE'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'EXCEPTION'
  | 'RETURNED'
  | 'CANCELLED'

export const TRACKING_STATUS_LABELS: Record<TrackingStatus, string> = {
  BOOKED: 'Booked',
  LABEL_CREATED: 'Label created',
  PICKED_UP: 'Picked up',
  IN_TRANSIT: 'In transit',
  CUSTOMS_CLEARANCE: 'Customs clearance',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  EXCEPTION: 'Problem (exception)',
  RETURNED: 'Returned',
  CANCELLED: 'Cancelled',
}

/** Display order for menus (the server decides which ones are allowed). */
export const TRACKING_STATUSES = Object.keys(
  TRACKING_STATUS_LABELS,
) as TrackingStatus[]

export type ShipmentSummary = {
  id: string
  orderReference: string
  /** true = linked to a website order (orderReference is its number) */
  websiteOrder: boolean
  awb: string
  providerCode: string
  providerName: string
  destinationCountry: string
  destinationCity: string | null
  status: TrackingStatus
  createdAt: string
  updatedAt: string
}

export type TrackingEvent = {
  id: string
  status: TrackingStatus
  occurredAt: string
  location: string | null
  note: string | null
  source: 'MANUAL' | 'API'
  recordedBy: string
}

export type ShipmentDetail = {
  id: string
  providerId: string
  providerCode: string
  providerName: string
  serviceId: string | null
  serviceName: string | null
  orderReference: string
  awb: string
  destinationCountry: string
  destinationCity: string | null
  weightKg: string | null
  courierCost: Money | null
  status: TrackingStatus
  bookingMethod: 'MANUAL' | 'API'
  trackingUrl: string | null
  allowedNextStatuses: TrackingStatus[]
  manualTracking: boolean
  events: TrackingEvent[]
  createdBy: string
  createdAt: string
  /** The linked website order, or null. */
  orderNumber: string | null
  /** What the customer paid for delivery (website orders only). */
  deliveryCharged: Money | null
  expenses: CourierExpense[]
  /** Base charge + extra charges. */
  totalCourierCost: Money
}

export type ExpenseKind = 'SURCHARGE' | 'RETURN' | 'ADJUSTMENT'

export const EXPENSE_KIND_LABELS: Record<ExpenseKind, string> = {
  SURCHARGE: 'Surcharge',
  RETURN: 'Return fee',
  ADJUSTMENT: 'Adjustment (+/−)',
}

export type CourierExpense = {
  id: string
  kind: ExpenseKind
  amount: Money
  reference: string | null
  incurredOn: string
  note: string | null
  recordedBy: string
}

export type ExpenseInput = {
  kind: ExpenseKind
  amount: string
  reference: string | null
  incurredOn: string | null
  note: string | null
}

export type ExpensesReport = {
  from: string
  to: string
  rows: {
    shipmentId: string
    createdAt: string
    orderReference: string
    websiteOrder: boolean
    providerName: string
    awb: string
    status: TrackingStatus
    deliveryCharged: Money | null
    courierBase: Money | null
    extraCharges: Money
    totalCourierCost: Money | null
    margin: Money | null
  }[]
  shipmentCount: number
  shipmentsWithoutCourierCost: number
  deliveryCharged: Money
  courierCosts: Money
  grossMargin: Money
}

export type ShipmentDetailsInput = {
  serviceId: string | null
  orderReference: string
  awb: string
  destinationCountry: string
  destinationCity: string | null
  weightKg: string | null
  courierCost: string | null
}

export type TrackingUpdateInput = {
  status: TrackingStatus
  occurredAt: string | null
  location: string | null
  note: string | null
}

const SHIPMENTS = `${BASE}/shipments`

export async function addExpense(shipmentId: string, input: ExpenseInput) {
  return (
    await http.post<ShipmentDetail>(
      `${SHIPMENTS}/${encodeURIComponent(shipmentId)}/expenses`,
      input,
    )
  ).data
}

export async function getExpensesReport(
  from: string,
  to: string,
  signal?: AbortSignal,
) {
  return (
    await http.get<ExpensesReport>(`${SHIPMENTS}/expenses-report`, {
      params: { from, to },
      signal,
    })
  ).data
}

export async function listShipments(
  query: {
    q?: string
    status?: TrackingStatus
    providerId?: string
    page?: number
    size?: number
    /** only parcels still on their way */
    active?: boolean
    /** 'updated' = least recently updated first */
    order?: 'created' | 'updated'
  },
  signal?: AbortSignal,
) {
  const { q, status, providerId, page = 0, size = 20, active, order } = query
  return (
    await http.get<Page<ShipmentSummary>>(SHIPMENTS, {
      params: {
        q: q || undefined,
        status: status || undefined,
        providerId: providerId || undefined,
        active: active || undefined,
        order: order || undefined,
        page,
        size,
      },
      signal,
    })
  ).data
}

export async function getShipment(shipmentId: string, signal?: AbortSignal) {
  return (
    await http.get<ShipmentDetail>(`${SHIPMENTS}/${id(shipmentId)}`, { signal })
  ).data
}

export async function createShipment(input: {
  providerId: string
  orderNumber: string | null
  /** Shipping before payment arrived: why (kept in the order history). */
  shipBeforePaymentReason?: string | null
  bookedAt: string | null
  details: ShipmentDetailsInput
}) {
  return (await http.post<ShipmentDetail>(SHIPMENTS, input)).data
}

export async function updateShipment(
  shipmentId: string,
  input: ShipmentDetailsInput,
) {
  return (
    await http.put<ShipmentDetail>(`${SHIPMENTS}/${id(shipmentId)}`, input)
  ).data
}

export async function addTrackingUpdate(
  shipmentId: string,
  input: TrackingUpdateInput,
) {
  return (
    await http.post<ShipmentDetail>(
      `${SHIPMENTS}/${id(shipmentId)}/tracking`,
      input,
    )
  ).data
}

/** Names shown in the admin for each shipping category. */
export const SHIPPING_CATEGORY_LABELS: Record<ShippingCategory, string> = {
  GENERAL: 'General goods',
  FOOD_SHELF_STABLE: 'Shelf-stable food (rich cake, sweets, dried fish)',
  FOOD_PERISHABLE: 'Perishable food (fresh cakes)',
  FRAGILE: 'Fragile items',
}
