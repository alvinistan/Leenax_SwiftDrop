import { Globe2 } from 'lucide-react'
import { useId, useState } from 'react'
import { Link } from 'react-router'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { Checkbox } from '../../../components/ui/Checkbox'
import { ErrorState } from '../../../components/ui/ErrorState'
import type { ShippingCategory } from '../../../features/admin/adminProductApi'
import {
  getDestinations,
  listCategoryPolicies,
  listProductRestrictions,
  SHIPPING_CATEGORY_LABELS,
  updateCategoryPolicy,
  updateDestinations,
  type CategoryPolicy,
  type Country,
} from '../../../features/shipping/shippingApi'
import { CountryBlockPicker } from '../../../features/shipping/CountryBlockPicker'
import {
  StatusMessage,
  type Message,
} from '../../../features/shipping/StatusMessage'
import { useCountries } from '../../../features/shipping/useCountries'
import { useAsync } from '../../../hooks/useAsync'
import { userMessage } from '../../../lib/errors'

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

      {countryState.status === 'success' && (
        <DestinationsCard countries={countries} nameOf={nameOf} />
      )}

      <h2 className="mt-10 text-lg font-semibold text-slate-900">
        Rules per kind of product
      </h2>
      <div className="mt-4 flex flex-col gap-6">
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

      {countryState.status === 'success' && (
        <ProductRestrictions nameOf={nameOf} />
      )}
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
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<Message>()
  const headingId = useId()
  const label = SHIPPING_CATEGORY_LABELS[policy.category as ShippingCategory]

  const isDirty =
    international !== saved.internationalAllowed ||
    blocked.join() !== [...saved.blockedCountries].sort().join()

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
          <CountryBlockPicker
            value={blocked}
            onChange={(codes) => {
              setBlocked(codes)
              setMessage(undefined)
            }}
            countries={countries}
            nameOf={nameOf}
            subject={label}
          />
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

/** Products restricted one by one (edited in the product form, not here). */
function ProductRestrictions({ nameOf }: { nameOf: (code: string) => string }) {
  const { state, retry } = useAsync(
    (signal) => listProductRestrictions(signal),
    'shipping-product-restrictions',
  )
  return (
    <section aria-labelledby="product-restrictions-heading" className="mt-10">
      <h2
        id="product-restrictions-heading"
        className="text-lg font-semibold text-slate-900"
      >
        Products with their own restrictions
      </h2>
      <p className="mt-1 max-w-3xl text-sm text-slate-600">
        When only some products in a category are refused by a country (for
        example dried fish but not rich cake), restrict those products instead
        of the whole category: open the product and use &quot;Where this product
        may be sent&quot;. A product can only add restrictions to its
        category&apos;s rules.
      </p>
      <div className="mt-4">
        {state.status === 'loading' && (
          <p className="text-slate-600">Loading products…</p>
        )}
        {state.status === 'error' && (
          <ErrorState description={userMessage(state.error)} onRetry={retry} />
        )}
        {state.status === 'success' && state.data.length === 0 && (
          <p className="text-sm text-slate-500">
            No product has its own restrictions.
          </p>
        )}
        {state.status === 'success' && state.data.length > 0 && (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {state.data.map((p) => (
              <li
                key={p.productId}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">
                    {p.productName}
                  </p>
                  <p className="text-sm text-slate-600">
                    {p.domesticOnly
                      ? 'Sri Lanka only'
                      : `Blocked: ${p.blockedCountries.map(nameOf).join(', ')}`}
                  </p>
                </div>
                <Link
                  to={`/admin/products/${p.productId}/edit`}
                  className="text-sm font-semibold text-brand-800 hover:underline"
                >
                  Edit <span className="sr-only">{p.productName}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

/** Which countries customers can choose at checkout (owner decision D-3). */
function DestinationsCard({
  countries,
  nameOf,
}: {
  countries: Country[]
  nameOf: (code: string) => string
}) {
  const { state, retry } = useAsync(
    (signal) => getDestinations(signal),
    'shipping-destinations',
  )
  const [chosen, setChosen] = useState<string[]>()
  const [message, setMessage] = useState<Message>()
  const [isSaving, setIsSaving] = useState(false)
  const saved =
    state.status === 'success' ? state.data.filter((c) => c !== 'LK') : []
  const value = chosen ?? saved
  const isDirty = chosen !== undefined && chosen.join() !== saved.join()

  async function save() {
    setIsSaving(true)
    setMessage(undefined)
    try {
      await updateDestinations(value)
      setChosen(undefined)
      retry()
      setMessage({ tone: 'success', text: 'Delivery countries saved.' })
    } catch (error) {
      setMessage({ tone: 'error', text: userMessage(error) })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card
      className="mt-6 p-5"
      role="region"
      aria-labelledby="destinations-heading"
    >
      <h2
        id="destinations-heading"
        className="text-lg font-semibold text-slate-900"
      >
        Countries we deliver to
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Customers can only choose these countries at checkout. Sri Lanka is
        always included.
      </p>
      {state.status === 'error' && (
        <ErrorState description={userMessage(state.error)} onRetry={retry} />
      )}
      {state.status === 'success' && (
        <>
          <CountryBlockPicker
            value={value}
            onChange={(codes) => {
              setChosen(codes)
              setMessage(undefined)
            }}
            countries={countries}
            nameOf={nameOf}
            subject="delivery"
            addLabel="Add"
            removeLabel="Remove"
            emptyText="Only Sri Lanka."
            tone="allow"
          />
          <StatusMessage message={message} className="mt-4" />
          <div className="mt-4 flex gap-2">
            <Button onClick={save} disabled={!isDirty} isLoading={isSaving}>
              Save countries
            </Button>
            {isDirty && (
              <Button variant="secondary" onClick={() => setChosen(undefined)}>
                Undo changes
              </Button>
            )}
          </div>
        </>
      )}
    </Card>
  )
}
