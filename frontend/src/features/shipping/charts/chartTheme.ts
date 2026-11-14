/*
 * Chart colours, validated for colour-vision deficiencies and contrast on the
 * white surface (dataviz palette check). Colour follows the MEANING, never
 * the position: delivery charged is always blue, courier costs always orange.
 */
export const CHART = {
  /** categorical slot 1 */
  charged: '#2a78d6',
  /** categorical slot 2 */
  costs: '#eb6834',
  /** single-series bars (breakdowns) */
  single: '#2a78d6',
  /** diverging pair for the margin: above / below zero */
  gain: '#2a78d6',
  loss: '#e34948',
  grid: '#e7e5e4',
  axis: '#78716c',
  text: '#44403c',
} as const

/** Decimal string (exact) to a number for drawing only; amounts shown as text stay exact. */
export const toNumber = (amount: string) => Number(amount)
