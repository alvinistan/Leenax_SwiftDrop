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
}

export type ProviderInput = Omit<
  CourierProvider,
  'id' | 'code' | 'name' | 'services'
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

/** Names shown in the admin for each shipping category. */
export const SHIPPING_CATEGORY_LABELS: Record<ShippingCategory, string> = {
  GENERAL: 'General goods',
  FOOD_SHELF_STABLE: 'Shelf-stable food (rich cake, sweets, dried fish)',
  FOOD_PERISHABLE: 'Perishable food (fresh cakes)',
  FRAGILE: 'Fragile items',
}
