/*
 * Exact decimal arithmetic on strings using BigInt (whole numbers of any size).
 * Why: in JavaScript 0.1 + 0.2 === 0.30000000000000004, so prices and weights
 * must never be calculated with normal numbers.
 *
 * Values are "scaled": '1.5' with scale 3 becomes 1500n.
 */

export function toScaled(value: string, scale: number): bigint {
  const [whole, fraction = ''] = value.trim().split('.')
  return BigInt((whole || '0') + fraction.padEnd(scale, '0').slice(0, scale))
}

export function fromScaled(value: bigint, scale: number): string {
  const digits = value.toString().padStart(scale + 1, '0')
  if (scale === 0) return digits
  return `${digits.slice(0, -scale)}.${digits.slice(-scale)}`
}

/** Removes needless zeros: '1.500' → '1.5', '2.000' → '2'. */
export function trimZeros(value: string): string {
  return value.includes('.') ? value.replace(/\.?0+$/, '') : value
}
