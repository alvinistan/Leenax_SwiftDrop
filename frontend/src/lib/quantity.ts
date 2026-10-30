import type { QuantityRules, SaleUnit } from '../types/catalog'
import { fromScaled, toScaled, trimZeros } from './decimal'

const SCALE = 3 // quantities have up to 3 decimals, e.g. 0.125 kg

/** The next allowed quantity up (+1 step) or down (−1 step), kept within min and max. */
export function stepQuantity(
  current: string,
  rules: QuantityRules,
  direction: 1 | -1,
): string {
  const min = toScaled(rules.min, SCALE)
  const step = toScaled(rules.step, SCALE)
  let next = toScaled(current, SCALE) + BigInt(direction) * step
  if (next < min) next = min
  if (rules.max !== null) {
    const max = toScaled(rules.max, SCALE)
    if (next > max) next = max
  }
  return trimZeros(fromScaled(next, SCALE))
}

export function canStep(
  current: string,
  rules: QuantityRules,
  direction: 1 | -1,
): boolean {
  return stepQuantity(current, rules, direction) !== trimZeros(current)
}

/** '1.5 kg' or '2' (pieces). */
export function formatQuantity(quantity: string, unit: SaleUnit): string {
  return unit === 'KG' ? `${trimZeros(quantity)} kg` : trimZeros(quantity)
}
