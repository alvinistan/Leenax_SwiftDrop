import { Minus, Plus } from 'lucide-react'
import { useId } from 'react'
import { canStep, formatQuantity, stepQuantity } from '../../lib/quantity'
import type { QuantityRules, SaleUnit } from '../../types/catalog'

type QuantitySelectorProps = {
  rules: QuantityRules
  unit: SaleUnit
  value: string
  onChange: (value: string) => void
}

function describeRules(rules: QuantityRules, unit: SaleUnit): string {
  if (unit === 'PIECE') {
    return rules.max ? `Up to ${rules.max}` : ''
  }
  const range = rules.max
    ? `${rules.min}–${rules.max} kg`
    : `From ${rules.min} kg`
  return `${range}, in ${rules.step} kg steps`
}

/**
 * − / + buttons that move by the variant's step and stop at min and max, so the
 * customer can only pick a quantity the shop allows. (The server checks again.)
 */
export function QuantitySelector({
  rules,
  unit,
  value,
  onChange,
}: QuantitySelectorProps) {
  const labelId = useId()
  const label = unit === 'KG' ? 'Weight' : 'Quantity'
  const hint = describeRules(rules, unit)
  const buttonClasses =
    'flex size-11 items-center justify-center text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <div>
      <p id={labelId} className="text-sm font-semibold text-slate-900">
        {label}
      </p>
      <div
        role="group"
        aria-labelledby={labelId}
        className="mt-3 inline-flex items-center overflow-hidden rounded-lg border border-slate-300"
      >
        <button
          type="button"
          className={buttonClasses}
          onClick={() => onChange(stepQuantity(value, rules, -1))}
          disabled={!canStep(value, rules, -1)}
          aria-label={`Decrease ${label.toLowerCase()}`}
        >
          <Minus className="size-4" aria-hidden="true" />
        </button>
        {/* aria-live: screen readers announce the new value after each click */}
        <output
          aria-live="polite"
          className="min-w-20 px-3 text-center font-semibold text-slate-900"
        >
          {formatQuantity(value, unit)}
        </output>
        <button
          type="button"
          className={buttonClasses}
          onClick={() => onChange(stepQuantity(value, rules, 1))}
          disabled={!canStep(value, rules, 1)}
          aria-label={`Increase ${label.toLowerCase()}`}
        >
          <Plus className="size-4" aria-hidden="true" />
        </button>
      </div>
      {hint && <p className="mt-2 text-sm text-slate-500">{hint}</p>}
    </div>
  )
}
