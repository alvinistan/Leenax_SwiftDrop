import { z } from 'zod'

/** Delivery address form. The server checks everything again. */
export const addressSchema = z.object({
  recipientName: z
    .string()
    .trim()
    .min(1, 'Enter the name of the person receiving the parcel.')
    .max(100, 'At most 100 characters.'),
  phone: z
    .string()
    .trim()
    .regex(
      /^\+?[0-9 ()-]{7,30}$/,
      'Enter a phone number like +94 77 123 4567.',
    ),
  line1: z
    .string()
    .trim()
    .min(1, 'Enter the house number and street.')
    .max(150, 'At most 150 characters.'),
  line2: z.string().trim().max(150, 'At most 150 characters.'),
  city: z.string().trim().min(1, 'Enter the city or town.').max(100),
  region: z.string().trim().max(100, 'At most 100 characters.'),
  postalCode: z.string().trim().max(20, 'At most 20 characters.'),
  countryCode: z.string().regex(/^[A-Z]{2}$/, 'Choose a country.'),
  note: z.string().trim().max(500, 'At most 500 characters.'),
})
export type AddressFormValues = z.infer<typeof addressSchema>
