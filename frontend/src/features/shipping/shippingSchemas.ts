import { z } from 'zod'
import { toScaled } from '../../lib/decimal'

/*
 * Form rules for shipping administration, matching the backend's requests.
 * Numbers stay as text (exact decimals). The server checks everything again.
 */

const KG = /^\d{1,7}(\.\d{1,3})?$/
const CM = /^\d{1,7}(\.\d)?$/
const MONEY = /^\d{1,13}(\.\d{1,2})?$/
const PERCENT = /^\d{1,3}(\.\d{1,2})?$/
const COUNTRY = /^[A-Z]{2}$/

const optional = (pattern: RegExp, message: string) =>
  z.union([z.literal(''), z.string().trim().regex(pattern, message)])

const DECIMAL = /^\d+(\.\d+)?$/

/** True when the value is more than 0. Badly formatted values are left to the regex message. */
const positive = (value: string, scale: number) =>
  !DECIMAL.test(value) || toScaled(value, scale) > 0n

/**
 * Compare two decimal strings exactly (no floating point). Returns 0 when
 * either is badly formatted (the field's own message explains that).
 */
export function compareDecimals(a: string, b: string, scale = 3): number {
  if (!DECIMAL.test(a.trim()) || !DECIMAL.test(b.trim())) return 0
  const difference = toScaled(a, scale) - toScaled(b, scale)
  return difference === 0n ? 0 : difference > 0n ? 1 : -1
}

// ---- pickup address and defaults ----

export const settingsSchema = z.object({
  originLine1: z
    .string()
    .trim()
    .min(1, 'Address line 1 is required.')
    .max(150, 'At most 150 characters.'),
  originLine2: z.string().trim().max(150, 'At most 150 characters.'),
  originCity: z
    .string()
    .trim()
    .min(1, 'City is required.')
    .max(100, 'At most 100 characters.'),
  originPostalCode: z.string().trim().max(20, 'At most 20 characters.'),
  originCountry: z
    .string()
    .trim()
    .toUpperCase()
    .regex(COUNTRY, 'Use a two-letter country code, e.g. LK.'),
  defaultPackagingKg: z
    .string()
    .trim()
    .regex(KG, 'Enter kilograms, e.g. 0.25 (up to 3 decimals).'),
  dutiesPaidBy: z.enum(['RECEIVER', 'SENDER']),
})
export type SettingsFormValues = z.infer<typeof settingsSchema>

// ---- box sizes ----

const cm = (label: string) =>
  z
    .string()
    .trim()
    .regex(CM, `${label}: enter centimetres, e.g. 30 or 12.5.`)
    .refine((v) => positive(v, 1), `${label} must be more than 0.`)

export const boxSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required.')
    .max(60, 'At most 60 characters.'),
  lengthCm: cm('Length'),
  widthCm: cm('Width'),
  heightCm: cm('Height'),
  emptyWeightKg: z
    .string()
    .trim()
    .regex(KG, 'Enter kilograms, e.g. 0.2 (up to 3 decimals).'),
  maxWeightKg: optional(KG, 'Enter kilograms, e.g. 10.').refine(
    (v) => v === '' || positive(v, 3),
    'Maximum weight must be more than 0.',
  ),
  enabled: z.boolean(),
})
export type BoxFormValues = z.infer<typeof boxSchema>

// ---- platform fee ----

export const markupSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Name is required.')
      .max(100, 'At most 100 characters.'),
    type: z.enum(['PERCENT', 'FIXED', 'COMBINED']),
    percent: optional(PERCENT, 'Enter a percent like 2 or 1.5.'),
    fixedAmount: optional(MONEY, 'Enter an amount like 100 or 99.50.'),
    minFee: optional(MONEY, 'Enter an amount like 50.'),
    maxFee: optional(MONEY, 'Enter an amount like 500.'),
    providerId: z.string(),
    countryCode: z.union([
      z.literal(''),
      z.string().trim().toUpperCase().regex(COUNTRY, 'Choose a country.'),
    ]),
    effectiveFrom: z.string(),
    effectiveTo: z.string(),
    enabled: z.boolean(),
    priority: z.coerce
      .number<string>()
      .int('Use a whole number.')
      .min(0, 'At least 0.')
      .max(1000, 'At most 1000.'),
  })
  .superRefine((v, ctx) => {
    if (v.type !== 'FIXED') {
      if (v.percent === '') {
        ctx.addIssue({
          code: 'custom',
          path: ['percent'],
          message: 'Enter the percent.',
        })
      } else if (compareDecimals(v.percent, '100', 2) > 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['percent'],
          message: 'Percent cannot be more than 100.',
        })
      }
    }
    if (v.type !== 'PERCENT' && v.fixedAmount === '') {
      ctx.addIssue({
        code: 'custom',
        path: ['fixedAmount'],
        message: 'Enter the fixed amount.',
      })
    }
    if (
      v.minFee !== '' &&
      v.maxFee !== '' &&
      compareDecimals(v.maxFee, v.minFee, 2) < 0
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['maxFee'],
        message: 'The maximum must not be less than the minimum.',
      })
    }
    if (
      v.effectiveFrom !== '' &&
      v.effectiveTo !== '' &&
      v.effectiveTo <= v.effectiveFrom
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['effectiveTo'],
        message: 'The end must be after the start.',
      })
    }
  })
export type MarkupFormInput = z.input<typeof markupSchema>
export type MarkupFormValues = z.output<typeof markupSchema>

// ---- rate cards ----

export const rateCardSchema = z
  .object({
    serviceId: z.string().min(1, 'Choose a courier service.'),
    countryCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(COUNTRY, 'Choose a country.'),
    enabled: z.boolean(),
    bands: z
      .array(
        z.object({
          maxWeightKg: z
            .string()
            .trim()
            .regex(KG, 'Enter kilograms, e.g. 0.5 or 2.')
            .refine((v) => positive(v, 3), 'Must be more than 0.'),
          price: z
            .string()
            .trim()
            .regex(MONEY, 'Enter a price like 450 or 450.50.'),
        }),
      )
      .min(1, 'Add at least one weight band.')
      .max(100, 'At most 100 bands.'),
  })
  .superRefine((v, ctx) => {
    v.bands.forEach((band, index) => {
      const previous = v.bands[index - 1]
      if (
        index > 0 &&
        KG.test(band.maxWeightKg) &&
        KG.test(previous.maxWeightKg) &&
        compareDecimals(band.maxWeightKg, previous.maxWeightKg) <= 0
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['bands', index, 'maxWeightKg'],
          message: 'Must be more than the band above.',
        })
      }
    })
  })
export type RateCardFormValues = z.infer<typeof rateCardSchema>

// ---- shipments ----

export const shipmentSchema = z.object({
  providerId: z.string().min(1, 'Choose the courier.'),
  serviceId: z.string(),
  orderReference: z
    .string()
    .trim()
    .min(1, 'Order reference is required.')
    .max(60, 'At most 60 characters.'),
  awb: z
    .string()
    .trim()
    .regex(
      /^[A-Za-z0-9-]{4,40}$/,
      'Enter the tracking number (AWB): 4 to 40 letters, digits or hyphens.',
    ),
  destinationCountry: z
    .string()
    .regex(COUNTRY, 'Choose the destination country.'),
  destinationCity: z.string().trim().max(100, 'At most 100 characters.'),
  weightKg: optional(KG, 'Enter kilograms, e.g. 1.4.').refine(
    (v) => v === '' || positive(v, 3),
    'Weight must be more than 0.',
  ),
  courierCost: optional(MONEY, 'Enter an amount like 550 or 550.50.'),
  bookedAt: z.string(),
  /** Only when shipping before payment (checked in the form). */
  shipBeforePaymentReason: z
    .string()
    .trim()
    .max(300, 'At most 300 characters.'),
})
export type ShipmentFormValues = z.infer<typeof shipmentSchema>

export const trackingUpdateSchema = z.object({
  status: z.string().min(1, 'Choose the new status.'),
  occurredAt: z.string(),
  location: z.string().trim().max(100, 'At most 100 characters.'),
  note: z.string().trim().max(500, 'At most 500 characters.'),
})
export type TrackingUpdateFormValues = z.infer<typeof trackingUpdateSchema>
