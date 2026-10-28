/**
 * Money exactly as the backend will send it: the amount as a decimal
 * string (never a floating-point number) plus an ISO 4217 currency code.
 * The frontend only DISPLAYS money; all calculations happen on the server.
 */
export type Money = {
  amount: string
  currency: string
}

export type Category = {
  id: string
  name: string
  slug: string
  /** Uploaded by the admin when the category is created (Phases 6 and 7). */
  imageUrl: string | null
}

export type Product = {
  id: string
  name: string
  slug: string
  category: Category
  price: Money
  imageUrl: string | null
  inStock: boolean
  /** True for demonstration data that must never be presented as real stock. */
  isSample: boolean
}
