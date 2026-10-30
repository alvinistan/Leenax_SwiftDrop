import { NotFoundError } from '../../lib/errors'
import type {
  Category,
  Page,
  ProductDetail,
  ProductSummary,
} from '../../types/catalog'
import { sampleCategories, sampleProducts } from './sampleData'

/*
 * The ONE place the frontend gets catalogue data from. Pages call these
 * functions and never know where the data comes from.
 *
 * Today: sample data with a short fake delay.
 * Phase 5: the same functions call the backend with Axios
 *   (GET /api/categories, /api/products, /api/products/{slug}).
 */

/** True while the data is sample data; the UI shows "Sample" labels. */
export const USING_SAMPLE_DATA = true

export type ProductSort = 'newest' | 'name'

export type ProductQuery = {
  categorySlug?: string
  /** 0-based, like the API */
  page?: number
  size?: number
  sort?: ProductSort
}

// No delay in tests, so they run fast.
const FAKE_DELAY_MS = import.meta.env.MODE === 'test' ? 0 : 400

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) =>
    setTimeout(() => resolve(value), FAKE_DELAY_MS),
  )
}

function toSummary(product: ProductDetail): ProductSummary {
  const cheapest = product.variants
    .filter((variant) => variant.active)
    .reduce<ProductDetail['variants'][number] | null>(
      (lowest, variant) =>
        lowest === null ||
        Number(variant.price.amount) < Number(lowest.price.amount)
          ? variant
          : lowest,
      null,
    )
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    category: product.category,
    fromPrice: cheapest?.price ?? null,
    fromPriceUnit: cheapest?.saleUnit ?? null,
    status: product.status,
  }
}

export function listCategories(): Promise<Category[]> {
  return delay(sampleCategories)
}

export function listProducts(
  query: ProductQuery = {},
): Promise<Page<ProductSummary>> {
  const { categorySlug, page = 0, size = 8, sort = 'newest' } = query

  let products = sampleProducts
  if (categorySlug) {
    products = products.filter(
      (product) => product.category.slug === categorySlug,
    )
  }
  if (sort === 'name') {
    products = [...products].sort((a, b) => a.name.localeCompare(b.name))
  }

  const start = page * size
  return delay({
    content: products.slice(start, start + size).map(toSummary),
    page,
    size,
    totalElements: products.length,
    totalPages: Math.ceil(products.length / size),
  })
}

export function getProduct(slug: string): Promise<ProductDetail> {
  const product = sampleProducts.find((p) => p.slug === slug)
  if (!product) {
    return delay(null).then(() => {
      throw new NotFoundError(`Product not found: ${slug}`)
    })
  }
  return delay(product)
}
