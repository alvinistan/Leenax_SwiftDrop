import { z } from 'zod'
import { toScaled } from '../../lib/decimal'

/*
 * Form rules for a product and its variants, matching the backend's
 * ProductRequest/VariantRequest. Numbers stay as text in the form (exact
 * decimals); the patterns below check their format.
 *
 * Browser checks are for friendly feedback. The server checks everything again.
 */

const QUANTITY = /^\d{1,7}(\.\d{1,3})?$/
const CM = /^\d{1,6}(\.\d)?$/
const isWhole = (value: string) => toScaled(value, 3) % 1000n === 0n
const compare = (a: string, b: string) => {
  const difference = toScaled(a, 3) - toScaled(b, 3)
  return difference === 0n ? 0 : difference > 0n ? 1 : -1
}

const quantity = (label: string) =>
  z
    .string()
    .trim()
    .regex(
      QUANTITY,
      `${label}: enter a number like 1 or 0.5 (up to 3 decimals).`,
    )

export const variantSchema = z
  .object({
    /** Present when editing an existing variant. */
    id: z.string().optional(),
    sku: z
      .string()
      .trim()
      .min(1, 'SKU is required.')
      .max(64, 'SKU must be at most 64 characters.')
      .regex(
        /^[A-Za-z0-9._-]+$/,
        'Use only letters, numbers, dots, hyphens and underscores.',
      ),
    price: z
      .string()
      .trim()
      .regex(/^\d{1,15}(\.\d{1,2})?$/, 'Enter a price like 1250 or 1250.50.'),
    saleUnit: z.enum(['PIECE', 'KG']),
    minQuantity: quantity('Minimum'),
    maxQuantity: z.union([z.literal(''), quantity('Maximum')]),
    quantityStep: quantity('Step'),
    stockQuantity: quantity('Stock'),
    /** Packed weight of one sale unit in kg. Optional for now; needed for shipping quotes. */
    shippingWeightKg: z.union([z.literal(''), quantity('Shipping weight')]),
    lengthCm: z.union([
      z.literal(''),
      z
        .string()
        .trim()
        .regex(CM, 'Length: enter centimetres, e.g. 30 or 12.5.'),
    ]),
    widthCm: z.union([
      z.literal(''),
      z.string().trim().regex(CM, 'Width: enter centimetres, e.g. 20 or 12.5.'),
    ]),
    heightCm: z.union([
      z.literal(''),
      z.string().trim().regex(CM, 'Height: enter centimetres, e.g. 15 or 4.5.'),
    ]),
    options: z
      .array(
        z.object({
          name: z.string().trim().min(1, 'Option name is required.').max(50),
          value: z.string().trim().min(1, 'Option value is required.').max(100),
        }),
      )
      .max(5, 'A variant can have at most 5 options.'),
    active: z.boolean(),
  })
  // Rules that compare several fields ("cross-field validation").
  .superRefine((v, ctx) => {
    const check = (ok: boolean, path: string, message: string) => {
      if (!ok) ctx.addIssue({ code: 'custom', path: [path], message })
    }
    // Only compare values whose format is already valid.
    if (
      !QUANTITY.test(v.minQuantity) ||
      !QUANTITY.test(v.quantityStep) ||
      !QUANTITY.test(v.stockQuantity)
    )
      return
    check(
      compare(v.minQuantity, '0') > 0,
      'minQuantity',
      'Minimum must be more than 0.',
    )
    check(
      compare(v.quantityStep, '0') > 0,
      'quantityStep',
      'Step must be more than 0.',
    )
    if (v.maxQuantity && QUANTITY.test(v.maxQuantity)) {
      check(
        compare(v.maxQuantity, v.minQuantity) >= 0,
        'maxQuantity',
        'Maximum cannot be below the minimum.',
      )
    }
    if (v.saleUnit === 'PIECE') {
      const whole = 'Pieces cannot be split: use a whole number.'
      check(isWhole(v.minQuantity), 'minQuantity', whole)
      check(isWhole(v.quantityStep), 'quantityStep', whole)
      check(!v.maxQuantity || isWhole(v.maxQuantity), 'maxQuantity', whole)
      check(isWhole(v.stockQuantity), 'stockQuantity', whole)
    }
    if (v.shippingWeightKg && QUANTITY.test(v.shippingWeightKg)) {
      check(
        compare(v.shippingWeightKg, '0') > 0,
        'shippingWeightKg',
        'Shipping weight must be more than 0.',
      )
    }
    const sides = [v.lengthCm, v.widthCm, v.heightCm].filter(Boolean).length
    if (sides !== 0 && sides !== 3) {
      for (const side of ['lengthCm', 'widthCm', 'heightCm'] as const) {
        if (!v[side])
          check(
            false,
            side,
            'Enter length, width and height together, or leave all three empty.',
          )
      }
    }
    const names = v.options.map((o) => o.name.trim().toLowerCase())
    names.forEach((name, i) => {
      if (name && names.indexOf(name) !== i) {
        ctx.addIssue({
          code: 'custom',
          path: ['options', i, 'name'],
          message: 'Each option name only once.',
        })
      }
    })
  })

export const productSchema = z
  .object({
    categoryId: z.string().min(1, 'Choose a category.'),
    name: z
      .string()
      .trim()
      .min(1, 'Name is required.')
      .max(200, 'Name must be at most 200 characters.'),
    slug: z
      .string()
      .min(1, 'Slug is required.')
      .max(200, 'Slug must be at most 200 characters.')
      .regex(
        /^[a-z0-9]+(-[a-z0-9]+)*$/,
        'Use only lowercase letters, numbers and single hyphens.',
      ),
    description: z
      .string()
      .max(5000, 'Description must be at most 5000 characters.'),
    shippingCategory: z.enum([
      'GENERAL',
      'FOOD_SHELF_STABLE',
      'FOOD_PERISHABLE',
      'FRAGILE',
    ]),
    hsCode: z.union([
      z.literal(''),
      z
        .string()
        .trim()
        .regex(
          /^[0-9]{4}(\.?[0-9]{2}){1,3}$/,
          'Enter an HS code like 0305.59 or 1905.90.90 (6 to 10 digits).',
        ),
    ]),
    countryOfOrigin: z
      .string()
      .trim()
      .regex(
        /^[A-Z]{2}$/,
        'Use a two-letter country code in capitals, e.g. LK.',
      ),
    customsDescription: z
      .string()
      .max(200, 'Customs description must be at most 200 characters.'),
    /** Sri Lanka only for this product (on top of its category's rules). */
    shippingDomesticOnly: z.boolean(),
    /** Extra blocked countries for this product. */
    shippingBlockedCountries: z.array(z.string().regex(/^[A-Z]{2}$/)).max(300),
    /** Tax included in the prices ('' = no tax). */
    taxRateId: z.string(),
    /** Cash on delivery may be offered (Sri Lanka only). */
    codAllowed: z.boolean(),
    status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']),
    variants: z
      .array(variantSchema)
      .min(1, 'Add at least one variant.')
      .max(100),
  })
  .superRefine((p, ctx) => {
    const skus = p.variants.map((v) => v.sku.trim().toUpperCase())
    skus.forEach((sku, i) => {
      if (sku && skus.indexOf(sku) !== i) {
        ctx.addIssue({
          code: 'custom',
          path: ['variants', i, 'sku'],
          message: 'This SKU is already used above.',
        })
      }
    })
    if (p.status === 'ACTIVE' && !p.variants.some((v) => v.active)) {
      ctx.addIssue({
        code: 'custom',
        path: ['status'],
        message: 'An active product needs at least one active variant.',
      })
    }
  })

export type ProductFormValues = z.infer<typeof productSchema>
export type VariantFormValues = z.infer<typeof variantSchema>

/** A new, empty variant with sensible defaults for its sale unit. */
export function newVariant(
  saleUnit: 'PIECE' | 'KG' = 'PIECE',
): VariantFormValues {
  return {
    sku: '',
    price: '',
    saleUnit,
    minQuantity: saleUnit === 'KG' ? '0.5' : '1',
    maxQuantity: '',
    quantityStep: saleUnit === 'KG' ? '0.5' : '1',
    stockQuantity: '0',
    shippingWeightKg: '',
    lengthCm: '',
    widthCm: '',
    heightCm: '',
    options: [],
    active: true,
  }
}
