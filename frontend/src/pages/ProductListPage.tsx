import { Link, useSearchParams } from 'react-router'
import { Container } from '../components/layout/Container'
import { Breadcrumbs } from '../components/navigation/Breadcrumbs'
import { Pagination } from '../components/navigation/Pagination'
import { buttonClasses } from '../components/ui/buttonStyles'
import {
  listCategories,
  listProducts,
  type ProductSort,
} from '../features/catalog/catalogApi'
import { CategoryFilter } from '../features/catalog/CategoryFilter'
import { ProductGrid } from '../features/catalog/ProductGrid'
import { SampleDataNotice } from '../features/catalog/SampleDataNotice'
import { useAsync, type AsyncState } from '../hooks/useAsync'
import type { ProductSummary } from '../types/catalog'

const PAGE_SIZE = 8

/**
 * /products?category=cakes-bakery&sort=name&page=2
 *
 * The filters live in the URL, not in useState. That means: the page can be
 * bookmarked and shared, Back/Forward work, and a refresh keeps the filters.
 */
export function ProductListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const categorySlug = searchParams.get('category') ?? undefined
  const sort: ProductSort =
    searchParams.get('sort') === 'name' ? 'name' : 'newest'
  // In the URL pages start at 1 (for people); the API starts at 0.
  const page = Math.max(1, Number(searchParams.get('page')) || 1)

  const categories = useAsync((signal) => listCategories(signal), 'categories')
  const products = useAsync(
    (signal) =>
      listProducts(
        { categorySlug, sort, page: page - 1, size: PAGE_SIZE },
        signal,
      ),
    `${categorySlug}|${sort}|${page}`,
  )

  /** A URL with some parameters changed and the rest kept. */
  function hrefWith(changes: Record<string, string | undefined>) {
    const next = new URLSearchParams(searchParams)
    for (const [name, value] of Object.entries(changes)) {
      if (value === undefined) next.delete(name)
      else next.set(name, value)
    }
    const query = next.toString()
    return query ? `?${query}` : '/products'
  }

  const category =
    categories.state.status === 'success'
      ? categories.state.data.find((c) => c.slug === categorySlug)
      : undefined
  const title = category?.name ?? 'All products'

  // ProductGrid wants the list; the page also needs the totals for pagination.
  const gridState: AsyncState<ProductSummary[]> =
    products.state.status === 'success'
      ? { status: 'success', data: products.state.data.content }
      : products.state

  return (
    <Container className="py-8">
      <title>{`${title} | Leenax SwiftDrop.lk`}</title>
      <Breadcrumbs
        items={
          category
            ? [
                { label: 'Home', to: '/' },
                { label: 'Shop', to: '/products' },
                { label: category.name },
              ]
            : [{ label: 'Home', to: '/' }, { label: 'Shop' }]
        }
      />

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
          {products.state.status === 'success' && (
            <p className="mt-1 text-slate-600">
              {products.state.data.totalElements}{' '}
              {products.state.data.totalElements === 1 ? 'product' : 'products'}
            </p>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          Sort by
          <select
            value={sort}
            onChange={(event) =>
              // A new sort order starts again at page 1.
              setSearchParams((current) => {
                const next = new URLSearchParams(current)
                next.set('sort', event.target.value)
                next.delete('page')
                return next
              })
            }
            className="h-10 rounded-lg border border-slate-300 bg-white px-3"
          >
            <option value="newest">Newest</option>
            <option value="name">Name (A–Z)</option>
          </select>
        </label>
      </div>

      <div className="mt-6">
        <SampleDataNotice />
      </div>

      {categories.state.status === 'success' && (
        <div className="mt-6">
          <CategoryFilter
            categories={categories.state.data}
            activeSlug={categorySlug}
            hrefFor={(slug) => hrefWith({ category: slug, page: undefined })}
          />
        </div>
      )}

      <div className="mt-8">
        <ProductGrid
          state={gridState}
          onRetry={products.retry}
          emptyAction={
            <Link
              to="/products"
              className={buttonClasses({ variant: 'secondary' })}
            >
              View all products
            </Link>
          }
        />
      </div>

      {products.state.status === 'success' && (
        <div className="mt-10">
          <Pagination
            page={page}
            totalPages={products.state.data.totalPages}
            hrefFor={(target) =>
              hrefWith({ page: target === 1 ? undefined : String(target) })
            }
          />
        </div>
      )}
    </Container>
  )
}
