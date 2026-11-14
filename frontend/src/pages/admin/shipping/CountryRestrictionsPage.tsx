import { Ban, Globe2, Search, X } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { Checkbox } from '../../../components/ui/Checkbox'
import { ErrorState } from '../../../components/ui/ErrorState'
import type { ShippingCategory } from '../../../features/admin/adminProductApi'
import {
  listCategoryPolicies,
  SHIPPING_CATEGORY_LABELS,
  updateCategoryPolicy,
  type CategoryPolicy,
  type Country,
} from '../../../features/shipping/shippingApi'
import {
  StatusMessage,
  type Message,
} from '../../../features/shipping/StatusMessage'
import { useCountries } from '../../../features/shipping/useCountries'
import { useAsync } from '../../../hooks/useAsync'
import { userMessage } from '../../../lib/errors'

const MAX_RESULTS = 8

/**
 * Where each kind of product may be sent: international on/off, plus
 * individual blocked countries. The server applies these rules to every quote.
 */
export function CountryRestrictionsPage() {
  const policies = useAsync(
    (signal) => listCategoryPolicies(signal),
    'shipping-category-policies',
  )
  const { state: countryState, countries, nameOf, retry } = useCountries()

  return (
    <>
      <title>Country restrictions | Shipping | Admin</title>
      <h1 className="text-2xl font-bold text-slate-900">
        Country restrictions
      </h1>
      <p className="mt-1 max-w-3xl text-sm text-slate-600">
        Choose where each kind of product may be sent. Delivery within Sri Lanka
        is always allowed. Blocking a country stops customers from getting a
        delivery price there for products in that category. Couriers and customs
        have their own rules too: check them before shipping food abroad.
      </p>

      <div className="mt-6 flex flex-col gap-6">
        {(policies.state.status === 'loading' ||
          countryState.status === 'loading') && (
          <p className="text-slate-600">Loading restrictions…</p>
        )}
        {policies.state.status === 'error' && (
          <ErrorState
            description={userMessage(policies.state.error)}
            onRetry={policies.retry}
          />
        )}
        {countryState.status === 'error' && (
          <ErrorState
            description={userMessage(countryState.error)}
            onRetry={retry}
          />
        )}
        {policies.state.status === 'success' &&
          countryState.status === 'success' &&
          policies.state.data.map((policy) => (
            <PolicyCard
              key={policy.category}
              policy={policy}
              countries={countries}
              nameOf={nameOf}
            />
          ))}
      </div>
    </>
  )
}

type PolicyCardProps = {
  policy: CategoryPolicy
  countries: Country[]
  nameOf: (code: string) => string
}

function PolicyCard({ policy, countries, nameOf }: PolicyCardProps) {
  const [saved, setSaved] = useState(policy)
  const [international, setInternational] = useState(
    policy.internationalAllowed,
  )
  const [blocked, setBlocked] = useState<string[]>(
    [...policy.blockedCountries].sort(),
  )
  const [query, setQuery] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<Message>()
  const headingId = useId()
  const searchId = useId()
  const label = SHIPPING_CATEGORY_LABELS[policy.category as ShippingCategory]

  const isDirty =
    international !== saved.internationalAllowed ||
    blocked.join() !== [...saved.blockedCountries].sort().join()

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return countries
      .filter((c) => c.code !== 'LK' && !blocked.includes(c.code))
      .filter(
        (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q,
      )
      .slice(0, MAX_RESULTS)
  }, [countries, blocked, query])

  function block(code: string) {
    setBlocked((current) => [...current, code].sort())
    setQuery('')
    setMessage(undefined)
  }

  function unblock(code: string) {
    setBlocked((current) => current.filter((c) => c !== code))
    setMessage(undefined)
  }

  async function save() {
    setIsSaving(true)
    setMessage(undefined)
    try {
      const updated = await updateCategoryPolicy(policy.category, {
        internationalAllowed: international,
        blockedCountries: blocked,
      })
      setSaved(updated)
      setBlocked([...updated.blockedCountries].sort())
      setInternational(updated.internationalAllowed)
      setMessage({ tone: 'success', text: `Saved restrictions for ${label}.` })
    } catch (error) {
      setMessage({ tone: 'error', text: userMessage(error) })
    } finally {
      setIsSaving(false)
    }
  }

  function reset() {
    setInternational(saved.internationalAllowed)
    setBlocked([...saved.blockedCountries].sort())
    setQuery('')
    setMessage(undefined)
  }

  return (
    <Card className="p-5" aria-labelledby={headingId} role="region">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 id={headingId} className="text-lg font-semibold text-slate-900">
          {label}
        </h2>
        {international ? (
          <Badge tone="success">
            <Globe2 className="mr-1 size-3.5" aria-hidden="true" />
            Sri Lanka and abroad
          </Badge>
        ) : (
          <Badge tone="warning">Sri Lanka only</Badge>
        )}
      </div>

      <div className="mt-4">
        <Checkbox
          label="Allow international shipping"
          hint="When off, this category can only be delivered within Sri Lanka."
          checked={international}
          onChange={(event) => {
            setInternational(event.target.checked)
            setMessage(undefined)
          }}
        />
      </div>

      <fieldset className="mt-5" disabled={!international}>
        <legend className="text-sm font-semibold text-slate-800">
          Blocked countries ({blocked.length})
        </legend>
        {!international && (
          <p className="mt-1 text-sm text-slate-500">
            International shipping is off, so every other country is blocked.
          </p>
        )}

        {international && (
          <div className="relative mt-2 max-w-md">
            <label htmlFor={searchId} className="sr-only">
              Find a country to block for {label}
            </label>
            <Search
              className="pointer-events-none absolute top-3 left-3 size-5 text-slate-400"
              aria-hidden="true"
            />
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a country to block…"
              autoComplete="off"
              className="h-11 w-full rounded-lg border border-slate-300 bg-white pr-3 pl-10 text-slate-900 placeholder:text-slate-400"
            />
            {query.trim() && (
              <ul
                aria-label="Matching countries"
                className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white"
              >
                {results.length === 0 && (
                  <li className="px-3 py-2 text-sm text-slate-500">
                    No matching country (or it is already blocked).
                  </li>
                )}
                {results.map((country) => (
                  <li key={country.code}>
                    <button
                      type="button"
                      onClick={() => block(country.code)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                    >
                      <span>
                        {country.name}{' '}
                        <span className="text-slate-500">({country.code})</span>
                      </span>
                      <span className="inline-flex items-center gap-1 font-semibold text-red-700">
                        <Ban className="size-4" aria-hidden="true" />
                        Block <span className="sr-only">{country.name}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {blocked.length === 0 ? (
          international && (
            <p className="mt-3 text-sm text-slate-500">No countries blocked.</p>
          )
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Blocked">
            {blocked.map((code) => (
              <li
                key={code}
                className="inline-flex items-center gap-1 rounded-full bg-red-50 py-1 pr-1 pl-3 text-sm font-medium text-red-800"
              >
                {nameOf(code)}
                <button
                  type="button"
                  onClick={() => unblock(code)}
                  aria-label={`Unblock ${nameOf(code)}`}
                  className="rounded-full p-1 hover:bg-red-100 disabled:opacity-50"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      <StatusMessage message={message} className="mt-4" />

      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={save}
          disabled={!isDirty}
          isLoading={isSaving}
        >
          Save changes <span className="sr-only">for {label}</span>
        </Button>
        {isDirty && (
          <Button type="button" variant="secondary" onClick={reset}>
            Undo changes
          </Button>
        )}
      </div>
    </Card>
  )
}
