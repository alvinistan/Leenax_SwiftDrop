import { Link } from 'react-router'
import { formatUnitPrice } from '../../lib/money'
import type { ProductSummary } from '../../types/catalog'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { ProductImage } from './ProductImage'

type ProductCardProps = {
  product: ProductSummary
  showSampleBadge?: boolean
}

export function ProductCard({
  product,
  showSampleBadge = false,
}: ProductCardProps) {
  return (
    // relative + the link's "after:absolute after:inset-0" makes the whole card clickable,
    // while screen readers still hear one simple link: the product name.
    <Card className="relative flex w-full flex-col transition-shadow hover:shadow-md">
      <div className="relative">
        <ProductImage src={null} alt={product.name} />
        {showSampleBadge && (
          <Badge tone="warning" className="absolute left-3 top-3">
            Sample
          </Badge>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {product.category.name}
        </p>
        <h3 className="mt-1 font-semibold text-slate-900">
          <Link
            to={`/products/${product.slug}`}
            className="after:absolute after:inset-0 hover:text-brand-700"
          >
            {product.name}
          </Link>
        </h3>
        {product.fromPrice && product.fromPriceUnit && (
          <p className="mt-auto pt-3 text-slate-600">
            <span className="text-sm">From </span>
            <span className="text-lg font-bold text-slate-900">
              {formatUnitPrice(product.fromPrice, product.fromPriceUnit)}
            </span>
          </p>
        )}
      </div>
    </Card>
  )
}
