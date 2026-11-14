import { ShoppingBag, Trash2 } from 'lucide-react'
import { Link } from 'react-router'
import { Container } from '../components/layout/Container'
import { Button } from '../components/ui/Button'
import { buttonClasses } from '../components/ui/buttonStyles'
import { ErrorState } from '../components/ui/ErrorState'
import { priceCart, type PricedCartLine } from '../features/cart/cartApi'
import { useCart } from '../features/cart/useCart'
import { QuantitySelector } from '../features/catalog/QuantitySelector'
import { useAsync } from '../hooks/useAsync'
import { userMessage } from '../lib/errors'
import { formatMoney } from '../lib/money'

/** The cart: current prices from the server for what is saved in this browser. */
export function CartPage() {
  const cart = useCart()

  if (cart.items.length === 0) {
    return (
      <Container className="py-24 text-center">
        <title>Cart | Leenax SwiftDrop.lk</title>
        <ShoppingBag
          className="mx-auto size-12 text-slate-400"
          aria-hidden="true"
        />
        <h1 className="mt-4 text-3xl font-bold text-slate-900">
          Your cart is empty
        </h1>
        <Link to="/products" className={`${buttonClasses()} mt-8`}>
          Continue shopping
        </Link>
      </Container>
    )
  }
  return <FilledCart />
}

function FilledCart() {
  const cart = useCart()
  // Re-priced whenever the cart changes (key = the cart's contents).
  const { state, retry } = useAsync(
    (signal) => priceCart(cart.items, signal),
    JSON.stringify(cart.items),
  )

  return (
    <Container className="py-10">
      <title>Cart | Leenax SwiftDrop.lk</title>
      <h1 className="text-3xl font-bold text-slate-900">Your cart</h1>

      {state.status === 'loading' && (
        <p className="mt-8 text-slate-600">Checking prices…</p>
      )}
      {state.status === 'error' && (
        <div className="mt-8">
          <ErrorState description={userMessage(state.error)} onRetry={retry} />
        </div>
      )}
      {state.status === 'success' && (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_20rem]">
          <ul
            aria-label="Items in your cart"
            className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white"
          >
            {state.data.lines.map((line) => (
              <CartLineRow key={line.variantId} line={line} />
            ))}
          </ul>

          <aside
            aria-labelledby="summary-heading"
            className="h-fit rounded-xl border border-slate-200 bg-white p-5"
          >
            <h2
              id="summary-heading"
              className="text-lg font-semibold text-slate-900"
            >
              Summary
            </h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-600">Items</dt>
                <dd className="font-semibold text-slate-900">
                  {formatMoney(state.data.itemsTotal)}
                </dd>
              </div>
              {Number(state.data.taxIncluded.amount) > 0 && (
                <div className="flex justify-between text-slate-500">
                  <dt>Includes tax</dt>
                  <dd>{formatMoney(state.data.taxIncluded)}</dd>
                </div>
              )}
              <div className="flex justify-between text-slate-500">
                <dt>Delivery</dt>
                <dd>At checkout</dd>
              </div>
            </dl>
            {state.data.orderable ? (
              <Link
                to="/checkout"
                className={`${buttonClasses({ size: 'lg' })} mt-6 w-full`}
              >
                Go to checkout
              </Link>
            ) : (
              <p
                role="alert"
                className="mt-6 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
              >
                Please fix the items marked above before checking out.
              </p>
            )}
          </aside>
        </div>
      )}
    </Container>
  )
}

function CartLineRow({ line }: { line: PricedCartLine }) {
  const cart = useCart()
  const name = line.productName ?? 'Unavailable item'
  return (
    <li className="flex flex-wrap gap-4 p-4">
      <div className="size-20 shrink-0 overflow-hidden rounded-lg bg-slate-100">
        {line.imageUrl && (
          <img src={line.imageUrl} alt="" className="size-full object-cover" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-900">
          {line.productSlug ? (
            <Link
              to={`/products/${line.productSlug}`}
              className="hover:underline"
            >
              {name}
            </Link>
          ) : (
            name
          )}
        </p>
        {line.variantLabel && (
          <p className="text-sm text-slate-600">{line.variantLabel}</p>
        )}
        {line.problem && (
          <p className="mt-1 text-sm font-medium text-red-700">
            {line.problem}
          </p>
        )}
        {line.rules && line.saleUnit && (
          <div className="mt-3 max-w-xs">
            <QuantitySelector
              rules={line.rules}
              unit={line.saleUnit}
              value={line.quantity}
              onChange={(quantity) =>
                cart.setQuantity(line.variantId, quantity)
              }
            />
          </div>
        )}
      </div>
      <div className="flex flex-col items-end justify-between gap-2">
        <p className="font-semibold text-slate-900">
          {line.lineTotal ? formatMoney(line.lineTotal) : '—'}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => cart.remove(line.variantId)}
        >
          <Trash2 className="size-4 text-red-700" aria-hidden="true" />
          Remove <span className="sr-only">{name}</span>
        </Button>
      </div>
    </li>
  )
}
