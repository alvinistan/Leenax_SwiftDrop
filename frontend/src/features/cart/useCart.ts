import { createContext, useContext } from 'react'
import type { CartItem } from './cartStorage'

export type CartContextValue = {
  items: CartItem[]
  /** Number of different products in the cart (shown in the header). */
  count: number
  add: (variantId: string, quantity: string) => void
  setQuantity: (variantId: string, quantity: string) => void
  remove: (variantId: string) => void
  clear: () => void
}

export const CartContext = createContext<CartContextValue | null>(null)

/** The cart saved in this browser. Use inside <CartProvider>. */
export function useCart(): CartContextValue {
  const value = useContext(CartContext)
  if (!value) throw new Error('useCart must be used inside <CartProvider>')
  return value
}
