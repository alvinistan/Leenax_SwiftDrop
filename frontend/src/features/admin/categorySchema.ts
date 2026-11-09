import { z } from 'zod'

/**
 * Form rules for a category, matching the backend's CategoryRequest.
 *
 * Checking in the browser gives instant, friendly feedback. It is NOT security:
 * anyone can bypass the browser, so the server validates everything again.
 */
export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required.')
    .max(100, 'Name must be at most 100 characters.'),
  slug: z
    .string()
    .min(1, 'Slug is required.')
    .max(100, 'Slug must be at most 100 characters.')
    .regex(
      /^[a-z0-9]+(-[a-z0-9]+)*$/,
      'Use only lowercase letters, numbers and single hyphens, e.g. home-kitchen.',
    ),
  description: z
    .string()
    .max(1000, 'Description must be at most 1000 characters.'),
  sortOrder: z
    .number({ error: 'Enter a number.' })
    .int('Enter a whole number.')
    .min(0, 'Sort order cannot be negative.'),
  active: z.boolean(),
})

/** The form's values, derived from the schema (one source of truth). */
export type CategoryFormValues = z.infer<typeof categorySchema>
