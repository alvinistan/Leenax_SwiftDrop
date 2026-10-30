import { ShoppingBag } from 'lucide-react'
import { Link } from 'react-router'
import { Container } from '../components/layout/Container'
import { buttonClasses } from '../components/ui/buttonStyles'

/** Placeholder until the real cart is built (Phase 8). */
export function CartPage() {
  return (
    <Container className="py-24 text-center">
      <title>Cart | Leenax SwiftDrop.lk</title>
      <ShoppingBag
        className="mx-auto size-12 text-slate-400"
        aria-hidden="true"
      />
      <h1 className="mt-4 text-3xl font-bold text-slate-900">Your cart</h1>
      <p className="mx-auto mt-3 max-w-md text-slate-600">
        The shopping cart is coming soon. For now, the cart count in the header
        is a preview only.
      </p>
      <Link to="/products" className={`${buttonClasses()} mt-8`}>
        Continue shopping
      </Link>
    </Container>
  )
}
