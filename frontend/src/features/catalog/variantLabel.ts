import type { Variant } from '../../types/catalog'

/** "1 kg cake", "M", "Black / M", or "Standard" when a variant has no options. */
export function variantLabel(variant: Variant): string {
  const values = Object.values(variant.options)
  return values.length > 0 ? values.join(' / ') : 'Standard'
}
