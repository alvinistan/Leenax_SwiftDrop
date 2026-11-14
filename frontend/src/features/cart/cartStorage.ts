import { fromScaled, toScaled, trimZeros } from '../../lib/decimal'

/**
 * The cart lives in this browser (local storage): only WHICH variant and HOW
 * MANY. Names and prices always come from the server (POST /api/cart/price),
 * so an old or edited cart can never change a price.
 */
export type CartItem = { variantId: string; quantity: string }

const KEY = 'swiftdrop-cart-v1'
const MAX_ITEMS = 50
const QUANTITY = /^\d{1,7}(\.\d{1,3})?$/

/** Reads the saved cart; anything malformed is dropped (it is user-editable storage). */
export function loadCart(): CartItem[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (item): item is CartItem =>
          typeof item?.variantId === 'string' &&
          typeof item?.quantity === 'string' &&
          QUANTITY.test(item.quantity),
      )
      .slice(0, MAX_ITEMS)
  } catch {
    return [] // private mode, blocked storage or bad JSON: start empty
  }
}

export function saveCart(items: CartItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items))
  } catch {
    // Storage full or blocked: the cart still works until the page is closed.
  }
}

export const CART_STORAGE_KEY = KEY

/** Adds to a line (exact decimal sum), or appends a new line. */
export function addItem(
  items: CartItem[],
  variantId: string,
  quantity: string,
) {
  const existing = items.find((i) => i.variantId === variantId)
  if (!existing) return [...items, { variantId, quantity }].slice(0, MAX_ITEMS)
  const sum = toScaled(existing.quantity, 3) + toScaled(quantity, 3)
  return items.map((i) =>
    i.variantId === variantId
      ? { ...i, quantity: trimZeros(fromScaled(sum, 3)) }
      : i,
  )
}
