import { Ban, Plus, Search, X } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import type { Country } from './shippingApi'

const MAX_RESULTS = 8

type Props = {
  /** Blocked country codes, A–Z. */
  value: string[]
  onChange: (codes: string[]) => void
  countries: Country[]
  nameOf: (code: string) => string
  /** Who the list is for, read by screen readers, e.g. "Dried fish". */
  subject: string
  /** The origin country, which can never be blocked. */
  originCountry?: string
  /** Wording, e.g. "Add" / "Remove" when the list is countries we deliver TO. */
  addLabel?: string
  removeLabel?: string
  emptyText?: string
  tone?: 'block' | 'allow'
}

/** Search for countries to block; blocked ones show as removable chips. */
export function CountryBlockPicker({
  value,
  onChange,
  countries,
  nameOf,
  subject,
  originCountry = 'LK',
  addLabel = 'Block',
  removeLabel = 'Unblock',
  emptyText = 'No countries blocked.',
  tone = 'block',
}: Props) {
  const [query, setQuery] = useState('')
  const searchId = useId()

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return countries
      .filter((c) => c.code !== originCountry && !value.includes(c.code))
      .filter(
        (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q,
      )
      .slice(0, MAX_RESULTS)
  }, [countries, value, query, originCountry])

  return (
    <div>
      <div className="relative mt-2 max-w-md">
        <label htmlFor={searchId} className="sr-only">
          Find a country to {addLabel.toLowerCase()} for {subject}
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
          placeholder={`Find a country to ${addLabel.toLowerCase()}…`}
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
                  onClick={() => {
                    onChange([...value, country.code].sort())
                    setQuery('')
                  }}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                >
                  <span>
                    {country.name}{' '}
                    <span className="text-slate-500">({country.code})</span>
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 font-semibold ${tone === 'block' ? 'text-red-700' : 'text-brand-800'}`}
                  >
                    {tone === 'block' ? (
                      <Ban className="size-4" aria-hidden="true" />
                    ) : (
                      <Plus className="size-4" aria-hidden="true" />
                    )}
                    {addLabel} <span className="sr-only">{country.name}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {value.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">{emptyText}</p>
      ) : (
        <ul
          className="mt-3 flex flex-wrap gap-2"
          aria-label={tone === 'block' ? 'Blocked' : 'Chosen countries'}
        >
          {value.map((code) => (
            <li
              key={code}
              className={`inline-flex items-center gap-1 rounded-full py-1 pr-1 pl-3 text-sm font-medium ${tone === 'block' ? 'bg-red-50 text-red-800' : 'bg-brand-50 text-brand-900'}`}
            >
              {nameOf(code)}
              <button
                type="button"
                onClick={() => onChange(value.filter((c) => c !== code))}
                aria-label={`${removeLabel} ${nameOf(code)}`}
                className="rounded-full p-1 hover:bg-black/10"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
