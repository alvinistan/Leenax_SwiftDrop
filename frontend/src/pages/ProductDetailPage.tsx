import { CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import { useOutletContext, useParams } from 'react-router'
import type { RootOutletContext } from '../components/layout/RootLayout'
import { Container } from '../components/layout/Container'
import { Breadcrumbs } from '../components/navigation/Breadcrumbs'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { ErrorState } from '../components/ui/ErrorState'
import { Skeleton } from '../components/ui/Skeleton'
import { getProduct, USING_SAMPLE_DATA } from '../features/catalog/catalogApi'
import { ProductImage } from '../features/catalog/ProductImage'
import { QuantitySelector } from '../features/catalog/QuantitySelector'
import { VariantSelector } from '../features/catalog/VariantSelector'
import { variantLabel } from '../features/catalog/variantLabel'
import { useAsync } from '../hooks/useAsync'
import { NotFoundError, userMessage } from '../lib/errors'
import { formatMoney, formatUnitPrice, multiplyMoney } from '../lib/money'
import { formatQuantity } from '../lib/quantity'
import type { ProductDetail } from '../types/catalog'
import { NotFoundContent } from './NotFoundPage'

/** /products/:slug, where :slug is a route parameter read with useParams(). */
export function ProductDetailPage() {
  const { slug = '' } = useParams()
  const { state, retry } = useAsync((signal) => getProduct(slug, signal), slug)

  if (state.status === 'loading') {
    return (
      <Container className="py-8">
        <div
          aria-busy="true"
          aria-label="Loading product"
          className="grid gap-10 md:grid-cols-2"
        >
          <Skeleton className="aspect-4/3 w-full" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </Container>
    )
  }

  if (state.status === 'error') {
    if (state.error instanceof NotFoundError) {
      return (
        <NotFoundContent
          title="Product not found"
          message="This product doesn't exist or is no longer available."
        />
      )
    }
    return (
      <Container className="py-8">
        <ErrorState
          title="We couldn't load this product"
          description={userMessage(state.error)}
          onRetry={retry}
        />
      </Container>
    )
  }

  // key: a different product gets fresh state (selected variant, quantity).
  return <ProductView key={state.data.id} product={state.data} />
}

function ProductView({ product }: { product: ProductDetail }) {
  const { addToCart } = useOutletContext<RootOutletContext>()
  const activeVariants = product.variants.filter((variant) => variant.active)

  const [variantId, setVariantId] = useState(activeVariants[0]?.id ?? '')
  const variant =
    activeVariants.find((v) => v.id === variantId) ?? activeVariants[0]
  const [quantity, setQuantity] = useState(variant?.quantity.min ?? '1')
  const [added, setAdded] = useState(false)

  function selectVariant(id: string) {
    const next = activeVariants.find((v) => v.id === id)
    setVariantId(id)
    // Each variant has its own rules, so start again at its minimum.
    if (next) setQuantity(next.quantity.min)
    setAdded(false)
  }

  const breadcrumbs = (
    <Breadcrumbs
      items={[
        { label: 'Home', to: '/' },
        {
          label: product.category.name,
          to: `/products?category=${product.category.slug}`,
        },
        { label: product.name },
      ]}
    />
  )

  return (
    <Container className="py-8">
      <title>{`${product.name} | Leenax SwiftDrop.lk`}</title>
      {breadcrumbs}

      <div className="mt-6 grid gap-10 md:grid-cols-2">
        {/* self-start: keep the image its own height instead of stretching to the text column. */}
        <div className="relative self-start overflow-hidden rounded-xl border border-slate-200">
          <ProductImage src={null} alt={product.name} />
          {USING_SAMPLE_DATA && (
            <Badge tone="warning" className="absolute left-3 top-3">
              Sample
            </Badge>
          )}
        </div>

        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
            {product.category.name}
          </p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            {product.name}
          </h1>
          {product.description && (
            <p className="mt-4 text-slate-700">{product.description}</p>
          )}

          {!variant ? (
            <p className="mt-8 font-medium text-slate-700">
              This product is currently unavailable.
            </p>
          ) : (
            <div className="mt-8 space-y-6">
              <p className="text-2xl font-bold text-slate-900">
                {formatUnitPrice(variant.price, variant.saleUnit)}
              </p>

              {/* Only ask when there is a real choice. */}
              {activeVariants.length > 1 && (
                <VariantSelector
                  variants={activeVariants}
                  selectedId={variant.id}
                  onSelect={selectVariant}
                />
              )}

              <QuantitySelector
                rules={variant.quantity}
                unit={variant.saleUnit}
                value={quantity}
                onChange={(value) => {
                  setQuantity(value)
                  setAdded(false)
                }}
              />

              <div className="rounded-lg bg-slate-50 p-4">
                <p className="flex justify-between text-slate-700">
                  <span>
                    {variantLabel(variant)} ×{' '}
                    {formatQuantity(quantity, variant.saleUnit)}
                  </span>
                  <span className="font-semibold text-slate-900">
                    {formatMoney(multiplyMoney(variant.price, quantity))}
                  </span>
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Estimated price. The final amount is confirmed at checkout.
                </p>
              </div>

              <Button
                size="lg"
                className="w-full sm:w-auto"
                onClick={() => {
                  addToCart()
                  setAdded(true)
                }}
              >
                Add to cart
              </Button>
              {added && (
                <p
                  role="status"
                  className="flex items-center gap-2 text-sm font-medium text-brand-800"
                >
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  Added to cart (preview only: the real cart arrives in a later
                  phase).
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </Container>
  )
}
