import { NotFoundError } from '../../lib/errors'
import type {
  Category,
  Page,
  ProductDetail,
  ProductSummary,
} from '../../types/catalog'
import type { ProductQuery } from './catalogApi'
import { sampleCategories, sampleProducts } from './sampleData'

/*
 * An in-memory version of the catalogue API, using the sample data.
 * Used when VITE_USE_SAMPLE_DATA=true, and by the tests' fake server (MSW).
 * It filters, sorts and pages exactly like the backend.
 */

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

export function sampleListCategories(): Promise<Category[]> {
  return delay(sampleCategories)
}

export function sampleListProducts(
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

export function sampleGetProduct(slug: string): Promise<ProductDetail> {
  const product = sampleProducts.find((p) => p.slug === slug)
  if (!product) {
    return delay(null).then(() => {
      throw new NotFoundError(`Product not found: ${slug}`)
    })
  }
  return delay(product)
}
