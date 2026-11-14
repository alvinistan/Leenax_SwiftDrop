import { http } from '../../api/http'
import type { Money, QuantityRules, SaleUnit } from '../../types/catalog'
import type { CartItem } from './cartStorage'

export type PricedCartLine = {
  variantId: string
  /** null when the item is no longer available */
  productName: string | null
  productSlug: string | null
  variantLabel: string | null
  saleUnit: SaleUnit | null
  rules: QuantityRules | null
  quantity: string
  unitPrice: Money | null
  lineTotal: Money | null
  taxIncluded: Money | null
  taxName: string | null
  codAllowed: boolean
  imageUrl: string | null
  /** Why this line cannot be ordered, or null. */
  problem: string | null
}

export type PricedCart = {
  lines: PricedCartLine[]
  itemsTotal: Money
  taxIncluded: Money
  orderable: boolean
}

/** Current prices for the cart, worked out by the server. */
export async function priceCart(
  items: CartItem[],
  signal?: AbortSignal,
): Promise<PricedCart> {
  return (await http.post<PricedCart>('/api/cart/price', { items }, { signal }))
    .data
}
