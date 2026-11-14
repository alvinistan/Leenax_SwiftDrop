import { useMemo } from 'react'
import { useAsync } from '../../hooks/useAsync'
import { listCountries, type Country } from './shippingApi'

/** ISO country list from the server, plus a code → name lookup. */
export function useCountries() {
  const { state, retry } = useAsync(
    (signal) => listCountries(signal),
    'shipping-countries',
  )
  const countries: Country[] = useMemo(
    () => (state.status === 'success' ? state.data : []),
    [state],
  )
  const nameOf = useMemo(() => {
    const names = new Map(countries.map((c) => [c.code, c.name]))
    return (code: string) => names.get(code) ?? code
  }, [countries])
  return { state, retry, countries, nameOf }
}
