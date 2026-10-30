import { http } from '../../api/http'
import type {
  Category,
  Page,
  ProductDetail,
  ProductSummary,
} from '../../types/catalog'
import {
  sampleGetProduct,
  sampleListCategories,
  sampleListProducts,
} from './sampleCatalog'

/*
 * The ONE place the frontend gets catalogue data from. Pages call these
 * functions and never know where the data comes from:
 * - normally: the Spring Boot API, through the shared Axios instance
 * - VITE_USE_SAMPLE_DATA=true: built-in sample data (no backend needed)
 */

/** True while showing sample data; the UI then shows "Sample" labels. */
export const USING_SAMPLE_DATA = import.meta.env.VITE_USE_SAMPLE_DATA === 'true'

export type ProductSort = 'newest' | 'name'

export type ProductQuery = {
  categorySlug?: string
  /** 0-based, like the API */
  page?: number
  size?: number
  sort?: ProductSort
}

/** Our sort names → the API's ?sort= values (only fields the backend allows). */
const SORT_PARAMS: Record<ProductSort, string> = {
  newest: 'createdAt,desc',
  name: 'name,asc',
}

/**
 * Each function takes an optional AbortSignal: when the page no longer needs
 * the answer (the user navigated away), the request is cancelled.
 * `await` waits for the Promise; `.data` is the parsed JSON body.
 */
export async function listCategories(
  signal?: AbortSignal,
): Promise<Category[]> {
  if (USING_SAMPLE_DATA) return sampleListCategories()
  const response = await http.get<Category[]>('/api/categories', { signal })
  return response.data
}

export async function listProducts(
  query: ProductQuery = {},
  signal?: AbortSignal,
): Promise<Page<ProductSummary>> {
  if (USING_SAMPLE_DATA) return sampleListProducts(query)
  const { categorySlug, page = 0, size = 8, sort = 'newest' } = query
  const response = await http.get<Page<ProductSummary>>('/api/products', {
    // Axios builds ?category=…&page=…&size=…&sort=… and leaves out undefined values.
    params: { category: categorySlug, page, size, sort: SORT_PARAMS[sort] },
    signal,
  })
  return response.data
}

export async function getProduct(
  slug: string,
  signal?: AbortSignal,
): Promise<ProductDetail> {
  if (USING_SAMPLE_DATA) return sampleGetProduct(slug)
  // encodeURIComponent: a slug from the URL must not be able to change the API path.
  const response = await http.get<ProductDetail>(
    `/api/products/${encodeURIComponent(slug)}`,
    {
      signal,
    },
  )
  return response.data
}
