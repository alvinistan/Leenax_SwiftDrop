import type { ReactNode } from 'react'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import type { AsyncState } from '../../hooks/useAsync'
import type { ProductSummary } from '../../types/catalog'
import { USING_SAMPLE_DATA } from './catalogApi'
import { ProductCard } from './ProductCard'
import { ProductCardSkeleton } from './ProductCardSkeleton'

type ProductGridProps = {
  state: AsyncState<ProductSummary[]>
  onRetry: () => void
  /** Shown when the list is empty, e.g. a "View all products" link. */
  emptyAction?: ReactNode
  skeletonCount?: number
}

const gridClasses =
  'grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'

/** Shows exactly one of four states: loading, error, empty, or the products. */
export function ProductGrid({
  state,
  onRetry,
  emptyAction,
  skeletonCount = 8,
}: ProductGridProps) {
  if (state.status === 'loading') {
    return (
      <div
        className={gridClasses}
        aria-busy="true"
        aria-label="Loading products"
      >
        {Array.from({ length: skeletonCount }, (_, index) => (
          <ProductCardSkeleton key={index} />
        ))}
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <ErrorState
        title="We couldn't load the products"
        description="Please check your connection and try again."
        onRetry={onRetry}
      />
    )
  }

  if (state.data.length === 0) {
    return (
      <EmptyState
        title="No products found"
        description="There are no products here yet. Please check back soon."
        action={emptyAction}
      />
    )
  }

  return (
    <ul className={gridClasses}>
      {state.data.map((product) => (
        <li key={product.id} className="flex">
          <ProductCard product={product} showSampleBadge={USING_SAMPLE_DATA} />
        </li>
      ))}
    </ul>
  )
}
