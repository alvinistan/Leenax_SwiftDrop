/**
 * Joins CSS class names, skipping empty values.
 * cn('a', isActive && 'b', undefined) → 'a b' (when isActive is true)
 */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}
