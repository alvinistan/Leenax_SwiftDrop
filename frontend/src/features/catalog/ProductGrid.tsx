import type { Product } from '../../types/catalog'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { ProductCard } from './ProductCard'
import { ProductCardSkeleton } from './ProductCardSkeleton'
import type { LoadStatus } from './useSampleProducts'

const SKELETON_COUNT = 8

type ProductGridProps = {
  status: LoadStatus
  products: Product[]
  onRetry: () => void
  onAddToCart: (product: Product) => void
}

const gridClasses =
  'grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'

/** Shows exactly one of four states: loading, error, empty, or the products. */
export function ProductGrid({
  status,
  products,
  onRetry,
  onAddToCart,
}: ProductGridProps) {
  if (status === 'loading') {
    return (
      <div
        className={gridClasses}
        aria-busy="true"
        aria-label="Loading products"
      >
        {Array.from({ length: SKELETON_COUNT }, (_, index) => (
          <ProductCardSkeleton key={index} />
        ))}
      </div>
    )
  }

  if (status === 'error') {
    return (
      <ErrorState
        title="We couldn't load the products"
        description="Please check your connection and try again."
        onRetry={onRetry}
      />
    )
  }

  if (products.length === 0) {
    return (
      <EmptyState
        title="No products yet"
        description="New products are being added. Please check back soon."
      />
    )
  }

  return (
    <ul className={gridClasses}>
      {products.map((product) => (
        // key tells React which item is which when the list changes.
        <li key={product.id} className="flex">
          <ProductCard product={product} onAddToCart={onAddToCart} />
        </li>
      ))}
    </ul>
  )
}
