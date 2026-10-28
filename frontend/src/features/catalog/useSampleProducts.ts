import { useEffect, useState } from 'react'
import type { Product } from '../../types/catalog'
import { sampleProducts } from './sampleData'

export type LoadStatus = 'loading' | 'success' | 'error'

/**
 * Lets you preview each screen state in the browser:
 *   /?demo=empty  → no products
 *   /?demo=error  → first load fails (then "Try again" succeeds)
 */
export type DemoMode = 'normal' | 'empty' | 'error'

const FAKE_NETWORK_DELAY_MS = 600

/**
 * Pretends to load products from a server, so the page can show real
 * loading, empty and error states before the backend exists.
 * Phase 5 replaces the timer with a real API call; the page will not change.
 */
export function useSampleProducts(demo: DemoMode = 'normal') {
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [products, setProducts] = useState<Product[]>([])
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    // Runs after render, and again whenever `attempt` or `demo` changes.
    const timer = setTimeout(() => {
      if (demo === 'error' && attempt === 0) {
        setStatus('error')
        return
      }
      setProducts(demo === 'empty' ? [] : sampleProducts)
      setStatus('success')
    }, FAKE_NETWORK_DELAY_MS)

    // Cleanup: cancel the timer if the component disappears or re-runs first.
    return () => clearTimeout(timer)
  }, [attempt, demo])

  function retry() {
    setStatus('loading')
    setAttempt((current) => current + 1)
  }

  return { status, products, retry }
}
