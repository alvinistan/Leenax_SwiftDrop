import { formatMoney } from '../../lib/money'
import type { Product } from '../../types/catalog'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ProductImage } from './ProductImage'

type ProductCardProps = {
  product: Product
  onAddToCart: (product: Product) => void
}

export function ProductCard({ product, onAddToCart }: ProductCardProps) {
  return (
    <Card className="flex w-full flex-col">
      <div className="relative">
        <ProductImage src={product.imageUrl} alt={product.name} />
        {product.isSample && (
          <Badge tone="warning" className="absolute left-3 top-3">
            Sample
          </Badge>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {product.category.name}
        </p>
        <h3 className="mt-1 font-semibold text-slate-900">{product.name}</h3>

        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-lg font-bold text-slate-900">
            {formatMoney(product.price)}
          </p>
          {product.inStock ? (
            <Badge tone="success">In stock</Badge>
          ) : (
            <Badge tone="danger">Out of stock</Badge>
          )}
        </div>

        <Button
          className="mt-4 w-full"
          disabled={!product.inStock}
          aria-label={
            product.inStock
              ? `Add ${product.name} to cart`
              : `${product.name} is out of stock`
          }
          onClick={() => onAddToCart(product)}
        >
          {product.inStock ? 'Add to cart' : 'Out of stock'}
        </Button>
      </div>
    </Card>
  )
}
