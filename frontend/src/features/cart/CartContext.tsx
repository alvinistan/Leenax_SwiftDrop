import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  addItem,
  CART_STORAGE_KEY,
  loadCart,
  saveCart,
  type CartItem,
} from './cartStorage'
import { CartContext, type CartContextValue } from './useCart'

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(loadCart)

  // Keep other tabs in step: the browser fires "storage" in the OTHER tabs.
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key === CART_STORAGE_KEY) setItems(loadCart())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const update = useCallback(
    (change: (current: CartItem[]) => CartItem[]) =>
      setItems((current) => {
        const next = change(current)
        saveCart(next)
        return next
      }),
    [],
  )

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      count: items.length,
      add: (variantId, quantity) =>
        update((current) => addItem(current, variantId, quantity)),
      setQuantity: (variantId, quantity) =>
        update((current) =>
          current.map((i) =>
            i.variantId === variantId ? { ...i, quantity } : i,
          ),
        ),
      remove: (variantId) =>
        update((current) => current.filter((i) => i.variantId !== variantId)),
      clear: () => update(() => []),
    }),
    [items, update],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
