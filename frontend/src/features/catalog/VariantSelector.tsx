import { formatUnitPrice } from '../../lib/money'
import type { Variant } from '../../types/catalog'
import { variantLabel } from './variantLabel'

type VariantSelectorProps = {
  variants: Variant[]
  selectedId: string
  onSelect: (variantId: string) => void
}

/**
 * Real radio buttons (one choice from many), styled as cards. Native radios give
 * keyboard support for free: Tab into the group, arrow keys to change.
 */
export function VariantSelector({
  variants,
  selectedId,
  onSelect,
}: VariantSelectorProps) {
  // e.g. "Size" when every variant uses the same option name
  const optionNames = [
    ...new Set(variants.flatMap((v) => Object.keys(v.options))),
  ]
  const legend =
    optionNames.length > 0
      ? `Choose ${optionNames.join(' / ').toLowerCase()}`
      : 'Choose an option'

  return (
    <fieldset>
      <legend className="text-sm font-semibold text-slate-900">{legend}</legend>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {variants.map((variant) => (
          <label key={variant.id} className="cursor-pointer">
            <input
              type="radio"
              name="variant"
              value={variant.id}
              checked={variant.id === selectedId}
              onChange={() => onSelect(variant.id)}
              className="peer sr-only"
            />
            <span className="flex h-full flex-col rounded-lg border border-slate-300 px-3 py-2 transition peer-checked:border-brand-700 peer-checked:bg-brand-50 peer-checked:ring-1 peer-checked:ring-brand-700 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600 hover:border-slate-400">
              <span className="font-medium text-slate-900">
                {variantLabel(variant)}
              </span>
              <span className="text-sm text-slate-600">
                {formatUnitPrice(variant.price, variant.saleUnit)}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
