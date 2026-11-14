import { AlertTriangle, Calculator, Plus, Search, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { Select } from '../../../components/ui/Select'
import {
  getAdminProduct,
  listAdminProducts,
  type AdminProductDetail,
  type AdminProductSummary,
} from '../../../features/admin/adminProductApi'
import { variantLabel } from '../../../features/catalog/variantLabel'
import {
  simulateQuote,
  type SimulatedQuote,
} from '../../../features/shipping/shippingApi'
import { useCountries } from '../../../features/shipping/useCountries'
import { userMessage } from '../../../lib/errors'
import { formatMoney } from '../../../lib/money'

type Line = {
  variantId: string
  label: string
  unit: 'PIECE' | 'KG'
  quantity: string
}

/**
 * Try a shipping price before customers see it: pick products and a
 * destination, and see every step (weights, box, courier price, fee).
 * Nothing is saved. Draft products can be tried too.
 */
export function QuoteSimulatorPage() {
  const { state: countryState, countries, nameOf } = useCountries()
  const [lines, setLines] = useState<Line[]>([])
  const [country, setCountry] = useState('LK')
  const [result, setResult] = useState<SimulatedQuote>()
  const [error, setError] = useState<string>()
  const [isRunning, setIsRunning] = useState(false)

  async function run(event: FormEvent) {
    event.preventDefault()
    setError(undefined)
    setResult(undefined)
    if (lines.length === 0) {
      setError('Add at least one product.')
      return
    }
    setIsRunning(true)
    try {
      setResult(
        await simulateQuote({
          countryCode: country,
          items: lines.map(({ variantId, quantity }) => ({
            variantId,
            quantity,
          })),
        }),
      )
    } catch (e) {
      setError(userMessage(e))
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <>
      <title>Quote simulator | Shipping | Admin</title>
      <h1 className="text-2xl font-bold text-slate-900">Quote simulator</h1>
      <p className="mt-1 max-w-3xl text-sm text-slate-600">
        See exactly how a delivery price is worked out. Nothing is saved, and
        customers never see the courier price or the platform fee.
      </p>

      <ProductPicker
        onAdd={(line) => {
          setResult(undefined)
          setLines((current) =>
            current.some((l) => l.variantId === line.variantId)
              ? current
              : [...current, line],
          )
        }}
      />

      <form onSubmit={run} noValidate>
        <Card className="mt-6 p-5">
          <h2 className="text-lg font-semibold text-slate-900">Parcel</h2>
          {lines.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">
              No products yet. Search above and add some.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {lines.map((line, index) => (
                <li
                  key={line.variantId}
                  className="grid items-end gap-3 sm:grid-cols-[1fr_10rem_auto]"
                >
                  <p className="pb-3 font-medium text-slate-800">
                    {line.label}
                  </p>
                  <Input
                    label={line.unit === 'KG' ? 'Weight (kg)' : 'Quantity'}
                    inputMode="decimal"
                    value={line.quantity}
                    onChange={(event) => {
                      const quantity = event.target.value
                      setResult(undefined)
                      setLines((current) =>
                        current.map((l, i) =>
                          i === index ? { ...l, quantity } : l,
                        ),
                      )
                    }}
                  />
                  <Button
                    variant="ghost"
                    aria-label={`Remove ${line.label}`}
                    onClick={() => {
                      setResult(undefined)
                      setLines((current) =>
                        current.filter((_, i) => i !== index),
                      )
                    }}
                  >
                    <Trash2
                      className="size-4 text-red-700"
                      aria-hidden="true"
                    />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-5 grid gap-4 sm:max-w-sm">
            {countryState.status === 'error' ? (
              <ErrorState description={userMessage(countryState.error)} />
            ) : (
              <Select
                label="Destination country"
                value={country}
                onChange={(event) => {
                  setResult(undefined)
                  setCountry(event.target.value)
                }}
              >
                {countries.length === 0 && (
                  <option value="LK">Sri Lanka</option>
                )}
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
          </div>
          {error && (
            <p
              role="alert"
              className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800"
            >
              {error}
            </p>
          )}
          <Button type="submit" className="mt-5" isLoading={isRunning}>
            <Calculator className="size-4" aria-hidden="true" /> Work out the
            price
          </Button>
        </Card>
      </form>

      {result && <Breakdown result={result} nameOf={nameOf} />}
    </>
  )
}

function ProductPicker({ onAdd }: { onAdd: (line: Line) => void }) {
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<AdminProductSummary[]>()
  const [product, setProduct] = useState<AdminProductDetail>()
  const [error, setError] = useState<string>()
  const [isSearching, setIsSearching] = useState(false)

  async function search(event: FormEvent) {
    event.preventDefault()
    setError(undefined)
    setProduct(undefined)
    setIsSearching(true)
    try {
      setFound((await listAdminProducts({ q: query.trim(), size: 10 })).content)
    } catch (e) {
      setError(userMessage(e))
    } finally {
      setIsSearching(false)
    }
  }

  async function choose(id: string) {
    setError(undefined)
    try {
      setProduct(await getAdminProduct(id))
    } catch (e) {
      setError(userMessage(e))
    }
  }

  return (
    <Card className="mt-6 p-5">
      <form
        onSubmit={search}
        role="search"
        className="flex flex-wrap items-end gap-3"
      >
        <div className="min-w-0 flex-1">
          <Input
            label="Find a product"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name or SKU"
          />
        </div>
        <Button type="submit" variant="secondary" isLoading={isSearching}>
          <Search className="size-4" aria-hidden="true" /> Search
        </Button>
      </form>
      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      {found && !product && (
        <ul
          aria-label="Products found"
          className="mt-4 divide-y divide-slate-100"
        >
          {found.length === 0 && (
            <li className="py-2 text-sm text-slate-500">No products found.</li>
          )}
          {found.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 py-2"
            >
              <span className="text-sm">
                <span className="font-medium text-slate-900">{p.name}</span>{' '}
                {p.status !== 'ACTIVE' && (
                  <Badge>{p.status.toLowerCase()}</Badge>
                )}{' '}
                {!p.shippingReady && (
                  <Badge tone="warning">Weight missing</Badge>
                )}
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => choose(p.id)}
              >
                Choose <span className="sr-only">{p.name}</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
      {product && (
        <div className="mt-4">
          <p className="text-sm font-semibold text-slate-800">
            {product.name}: choose an option
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {product.variants.map((v) => {
              const label = `${product.name} – ${variantLabel(v)}`
              return (
                <li key={v.id}>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      onAdd({
                        variantId: v.id,
                        label,
                        unit: v.saleUnit,
                        quantity: v.quantity.min,
                      })
                      setProduct(undefined)
                      setFound(undefined)
                      setQuery('')
                    }}
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    <span className="sr-only">Add</span> {variantLabel(v)}
                    {v.shippingWeightKg === null && ' (no weight)'}
                  </Button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </Card>
  )
}

function Breakdown({
  result,
  nameOf,
}: {
  result: SimulatedQuote
  nameOf: (code: string) => string
}) {
  const p = result.parcel
  return (
    <section aria-labelledby="result-heading" className="mt-6">
      <h2 id="result-heading" className="text-lg font-semibold text-slate-900">
        Result for {nameOf(result.destinationCountry)} (
        {result.domestic ? 'domestic' : 'international'})
      </h2>
      {!result.domestic && (
        <p className="mt-1 text-sm text-slate-600">
          Import duties and taxes:{' '}
          {result.dutiesPaidBy === 'RECEIVER'
            ? 'paid by the receiver'
            : 'paid by us'}
          .
        </p>
      )}

      {result.problems.length > 0 && (
        <div
          role="alert"
          className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-800"
        >
          <p className="font-semibold">Customers cannot get a price:</p>
          <ul className="mt-1 list-disc pl-5">
            {result.problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      )}
      {result.warnings.map((warning) => (
        <p
          key={warning}
          className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
        >
          <AlertTriangle
            className="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          {warning}
        </p>
      ))}

      {p && (
        <Card className="mt-4 p-5">
          <h3 className="font-semibold text-slate-900">Parcel</h3>
          <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-600">Items</dt>
              <dd>{p.itemsWeightKg} kg</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-600">Packaging</dt>
              <dd>{p.packagingKg} kg</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-600">Actual weight</dt>
              <dd className="font-semibold">{p.actualWeightKg} kg</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-600">Box</dt>
              <dd>
                {p.boxName
                  ? `${p.boxName} (${p.lengthCm} × ${p.widthCm} × ${p.heightCm} cm)`
                  : 'Size unknown'}
              </dd>
            </div>
          </dl>
        </Card>
      )}

      {result.options.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Courier options</caption>
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Courier
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Volumetric
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Chargeable
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Courier price
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Platform fee
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Customer pays
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.options.map((o) => (
                <tr key={o.serviceId}>
                  <th
                    scope="row"
                    className="px-4 py-3 font-medium text-slate-900"
                  >
                    {o.providerName} · {o.serviceName}
                    {!o.available && (
                      <span className="mt-1 block font-normal text-amber-800">
                        Not available: {o.unavailableReason}
                      </span>
                    )}
                  </th>
                  <td className="px-4 py-3 text-slate-600">
                    {o.volumetricWeightKg ? `${o.volumetricWeightKg} kg` : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {o.chargeableWeightKg ? `${o.chargeableWeightKg} kg` : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {o.courierPrice ? formatMoney(o.courierPrice) : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {o.platformFee ? formatMoney(o.platformFee) : '—'}
                    {o.markupDescription && (
                      <span className="block text-xs text-slate-500">
                        {o.markupDescription}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {o.customerPrice ? formatMoney(o.customerPrice) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
