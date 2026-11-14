import { useMemo } from 'react'

/** Country code → English name, using the browser's own list (no request needed). */
export function useCountries() {
  const nameOf = useMemo(() => {
    const names = new Intl.DisplayNames(['en'], { type: 'region' })
    return (code: string) => {
      try {
        return names.of(code) ?? code
      } catch {
        return code
      }
    }
  }, [])
  return { nameOf }
}
