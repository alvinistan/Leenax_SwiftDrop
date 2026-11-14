import { http } from '../../api/http'
import type { AdminImage } from './imageApi'
import type {
  CategoryRef,
  Money,
  Page,
  ProductStatus,
  QuantityRules,
  SaleUnit,
} from '../../types/catalog'

/** The backend's AdminProductSummary. */
export type AdminProductSummary = {
  id: string
  name: string
  slug: string
  category: CategoryRef
  status: ProductStatus
  variantCount: number
  fromPrice: Money | null
  fromPriceUnit: SaleUnit | null
  inStock: boolean
  imageUrl: string | null
  /** Every active variant has a shipping weight (needed for shipping quotes). */
  shippingReady: boolean
}

/** What kind of goods, for shipping (decides where a product may be sent). */
export type ShippingCategory =
  'GENERAL' | 'FOOD_SHELF_STABLE' | 'FOOD_PERISHABLE' | 'FRAGILE'

export type Dimensions = { lengthCm: string; widthCm: string; heightCm: string }

export type AdminVariant = {
  id: string
  sku: string
  price: Money
  saleUnit: SaleUnit
  quantity: QuantityRules
  options: Record<string, string>
  active: boolean
  /** Exact stock as a decimal string, e.g. "12" or "3.5". */
  stockQuantity: string
  inStock: boolean
  /** Packed weight of one sale unit in kg (one piece, or one kg sold). */
  shippingWeightKg: string | null
  dimensions: Dimensions | null
}

export type AdminProductDetail = {
  id: string
  name: string
  slug: string
  description: string | null
  category: CategoryRef
  status: ProductStatus
  currency: string
  variants: AdminVariant[]
  images: AdminImage[]
  shippingCategory: ShippingCategory
  hsCode: string | null
  countryOfOrigin: string
  customsDescription: string | null
  /** Sri Lanka only for this product, whatever its category allows. */
  shippingDomesticOnly: boolean
  /** Extra blocked countries for this product (on top of its category's). */
  shippingBlockedCountries: string[]
}

/**
 * What the form sends (the backend's ProductRequest). Prices and quantities
 * are decimal STRINGS, so JavaScript never rounds them; the backend reads them
 * as exact BigDecimal values.
 */
export type ProductInput = {
  categoryId: string
  name: string
  slug: string
  description: string | null
  status: ProductStatus
  variants: {
    id?: string
    sku: string
    price: string
    saleUnit: SaleUnit
    minQuantity: string
    maxQuantity: string | null
    quantityStep: string
    stockQuantity: string
    options: Record<string, string>
    active: boolean
    shippingWeightKg: string | null
    lengthCm: string | null
    widthCm: string | null
    heightCm: string | null
  }[]
  shippingCategory: ShippingCategory
  hsCode: string | null
  countryOfOrigin: string
  customsDescription: string | null
  /** Sri Lanka only for this product, whatever its category allows. */
  shippingDomesticOnly?: boolean
  /** Extra blocked countries for this product (on top of its category's). */
  shippingBlockedCountries?: string[]
}

export type AdminProductQuery = {
  q?: string
  status?: ProductStatus
  page?: number
  size?: number
}

export async function listAdminProducts(
  query: AdminProductQuery,
  signal?: AbortSignal,
): Promise<Page<AdminProductSummary>> {
  const { q, status, page = 0, size = 20 } = query
  return (
    await http.get<Page<AdminProductSummary>>('/api/admin/products', {
      params: { q: q || undefined, status, page, size },
      signal,
    })
  ).data
}

export async function getAdminProduct(
  id: string,
  signal?: AbortSignal,
): Promise<AdminProductDetail> {
  return (
    await http.get<AdminProductDetail>(
      `/api/admin/products/${encodeURIComponent(id)}`,
      { signal },
    )
  ).data
}

export async function createProduct(
  input: ProductInput,
): Promise<AdminProductDetail> {
  return (await http.post<AdminProductDetail>('/api/admin/products', input))
    .data
}

/** Saves the product and its whole variant list in one request (one database transaction). */
export async function updateProduct(
  id: string,
  input: ProductInput,
): Promise<AdminProductDetail> {
  return (
    await http.put<AdminProductDetail>(
      `/api/admin/products/${encodeURIComponent(id)}`,
      input,
    )
  ).data
}

export async function deleteProduct(id: string): Promise<void> {
  await http.delete(`/api/admin/products/${encodeURIComponent(id)}`)
}
