/*
 * These types mirror the backend API's JSON exactly (see
 * docs/phase-reports/phase-3-catalog-api.md), so switching from sample data
 * to the real API in Phase 5 needs no page changes.
 */

/** Money as a decimal string (never a float) plus an ISO 4217 currency code. */
export type Money = {
  amount: string
  currency: string
}

/** PIECE: price per piece, whole quantities. KG: price per kg, any allowed weight. */
export type SaleUnit = 'PIECE' | 'KG'

export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED'

export type Category = {
  id: string
  name: string
  slug: string
  description: string | null
  /** Uploaded by the admin (Phases 6–7). */
  imageUrl: string | null
  sortOrder: number
  active: boolean
}

export type CategoryRef = Pick<Category, 'id' | 'name' | 'slug'>

/** Allowed quantities, as decimal strings, e.g. { min: '0.5', max: '5', step: '0.5' }. */
export type QuantityRules = {
  min: string
  /** null = no upper limit */
  max: string | null
  step: string
}

export type Variant = {
  id: string
  sku: string
  /** Per piece, or per kg when saleUnit is KG. */
  price: Money
  saleUnit: SaleUnit
  quantity: QuantityRules
  /** e.g. { Size: '1 kg' } */
  options: Record<string, string>
  active: boolean
}

/** A product in a list (GET /api/products). */
export type ProductSummary = {
  id: string
  name: string
  slug: string
  category: CategoryRef
  fromPrice: Money | null
  fromPriceUnit: SaleUnit | null
  status: ProductStatus
}

/** A full product (GET /api/products/{slug}). */
export type ProductDetail = {
  id: string
  name: string
  slug: string
  description: string | null
  category: CategoryRef
  status: ProductStatus
  currency: string
  variants: Variant[]
}

/** One page of results (the backend's PageResponse). */
export type Page<T> = {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}
