import { http } from 'msw'
import type {
  AdminProductDetail,
  ProductInput,
} from '../features/admin/adminProductApi'
import type { Category } from '../types/catalog'
import { API, apiEmpty, apiJson, apiPreflight } from './apiResponses'

/*
 * Fake login and admin endpoints for tests, with a tiny in-memory "database"
 * that resetMockAdmin() empties before each test.
 */

export const ADMIN = {
  email: 'owner@example.com',
  password: 'correct-password-123',
}

type MockUser = {
  email: string
  displayName: string
  roles: string[]
  password: string
}
const ADMIN_USER: MockUser = {
  email: ADMIN.email,
  displayName: 'Administrator',
  roles: ['ADMIN'],
  password: ADMIN.password,
}
let users: MockUser[] = [ADMIN_USER]
/** Who is logged in (null = nobody). */
let current: MockUser | null = null
let categories: Category[] = []
let products: AdminProductDetail[] = []
/** The body of the last product POST/PUT, so tests can check what the form sent. */
export let lastProductRequest: ProductInput | undefined

export function resetMockAdmin() {
  current = null
  users = [ADMIN_USER]
  categories = []
  products = []
  lastProductRequest = undefined
}

/** Turns what the form sends into what the API returns (the backend does this for real). */
function toDetail(id: string, input: ProductInput): AdminProductDetail {
  const category =
    categories.find((c) => c.id === input.categoryId) ?? categories[0]
  return {
    id,
    name: input.name,
    slug: input.slug,
    description: input.description,
    category: { id: category.id, name: category.name, slug: category.slug },
    status: input.status,
    currency: 'LKR',
    images: [],
    shippingCategory: input.shippingCategory,
    hsCode: input.hsCode,
    countryOfOrigin: input.countryOfOrigin,
    customsDescription: input.customsDescription,
    shippingDomesticOnly: input.shippingDomesticOnly ?? false,
    shippingBlockedCountries: input.shippingBlockedCountries ?? [],
    taxRateId: input.taxRateId ?? null,
    codAllowed: input.codAllowed ?? false,
    variants: input.variants.map((v, i) => ({
      id:
        v.id ?? `${id}-var-${i + 1}-${Math.random().toString(36).slice(2, 6)}`,
      sku: v.sku,
      price: { amount: Number(v.price).toFixed(2), currency: 'LKR' },
      saleUnit: v.saleUnit,
      quantity: {
        min: v.minQuantity,
        max: v.maxQuantity,
        step: v.quantityStep,
      },
      options: v.options,
      active: v.active,
      stockQuantity: v.stockQuantity,
      inStock: Number(v.stockQuantity) >= Number(v.minQuantity),
      shippingWeightKg: v.shippingWeightKg,
      dimensions:
        v.lengthCm && v.widthCm && v.heightCm
          ? { lengthCm: v.lengthCm, widthCm: v.widthCm, heightCm: v.heightCm }
          : null,
    })),
  }
}

export function seedProduct(input: ProductInput): AdminProductDetail {
  const product = toDetail(`prod-${products.length + 1}`, input)
  products.push(product)
  return product
}

/** Starts a test already logged in as the admin. */
export function logInMockAdmin() {
  current = ADMIN_USER
}

export const CUSTOMER = {
  email: 'kamala@example.com',
  password: 'a-long-enough-password',
}

/** Starts a test logged in as a customer (creating the account if needed). */
export function logInMockCustomer() {
  let user = users.find((u) => u.email === CUSTOMER.email)
  if (!user) {
    user = { ...CUSTOMER, displayName: 'Kamala', roles: ['CUSTOMER'] }
    users.push(user)
  }
  current = user
}

export function seedCategory(
  category: Partial<Category> & { name: string; slug: string },
) {
  categories.push({
    id: `cat-${categories.length + 1}`,
    description: null,
    imageUrl: null,
    sortOrder: 0,
    active: true,
    ...category,
  })
}

const problem = (status: number, title: string, detail: string) =>
  apiJson({ title, status, detail }, { status })

const requireAdmin = () =>
  current?.roles.includes('ADMIN')
    ? null
    : problem(401, 'Unauthorized', 'Please log in to continue.')

export const adminHandlers = [
  // CORS preflight for every API path
  http.options(`${API}/api/*`, () => apiPreflight()),

  http.get(`${API}/api/auth/me`, () =>
    current
      ? apiJson({
          email: current.email,
          displayName: current.displayName,
          roles: current.roles,
        })
      : problem(401, 'Unauthorized', 'Please log in to continue.'),
  ),

  http.post(`${API}/api/auth/register`, async ({ request }) => {
    const body = (await request.json()) as {
      email: string
      password: string
      displayName: string
    }
    const email = body.email.toLowerCase()
    if (users.some((u) => u.email === email)) {
      return problem(
        409,
        'Conflict',
        'An account with this email already exists. Log in instead.',
      )
    }
    users.push({
      email,
      password: body.password,
      displayName: body.displayName,
      roles: ['CUSTOMER'],
    })
    return apiJson(
      { email, displayName: body.displayName, roles: ['CUSTOMER'] },
      { status: 201 },
    )
  }),

  http.post(`${API}/api/auth/login`, async ({ request }) => {
    const form = new URLSearchParams(await request.text())
    const user = users.find(
      (u) =>
        u.email === form.get('email')?.toLowerCase() &&
        u.password === form.get('password'),
    )
    if (user) {
      current = user
      return apiEmpty(204)
    }
    return problem(401, 'Unauthorized', 'The email or password is incorrect.')
  }),

  http.post(`${API}/api/auth/logout`, () => {
    current = null
    return apiEmpty(204)
  }),

  http.get(
    `${API}/api/admin/categories`,
    () => requireAdmin() ?? apiJson(categories),
  ),

  http.get(`${API}/api/admin/categories/:id`, ({ params }) => {
    const found = categories.find((c) => c.id === params.id)
    return (
      requireAdmin() ??
      (found ? apiJson(found) : problem(404, 'Not Found', 'Category not found'))
    )
  }),

  http.post(`${API}/api/admin/categories`, async ({ request }) => {
    const denied = requireAdmin()
    if (denied) return denied
    const body = (await request.json()) as Omit<Category, 'id' | 'imageUrl'>
    if (categories.some((c) => c.slug === body.slug)) {
      return problem(
        409,
        'Conflict',
        `A category with slug '${body.slug}' already exists.`,
      )
    }
    seedCategory(body)
    return apiJson(categories[categories.length - 1], { status: 201 })
  }),

  http.put(`${API}/api/admin/categories/:id`, async ({ params, request }) => {
    const denied = requireAdmin()
    if (denied) return denied
    const body = (await request.json()) as Omit<Category, 'id' | 'imageUrl'>
    categories = categories.map((c) =>
      c.id === params.id ? { ...c, ...body } : c,
    )
    return apiJson(categories.find((c) => c.id === params.id))
  }),

  http.delete(`${API}/api/admin/categories/:id`, ({ params }) => {
    const denied = requireAdmin()
    if (denied) return denied
    const found = categories.find((c) => c.id === params.id)
    if (found?.slug === 'has-products') {
      return problem(
        409,
        'Conflict',
        "Category 'has-products' still has products.",
      )
    }
    categories = categories.filter((c) => c.id !== params.id)
    return apiEmpty(204)
  }),

  // ---- products ----

  http.get(`${API}/api/admin/products`, ({ request }) => {
    const denied = requireAdmin()
    if (denied) return denied
    const params = new URL(request.url).searchParams
    const q = params.get('q')?.toLowerCase()
    const status = params.get('status')
    const found = products.filter(
      (p) =>
        (!q || p.name.toLowerCase().includes(q)) &&
        (!status || p.status === status),
    )
    return apiJson({
      content: found.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        category: p.category,
        status: p.status,
        variantCount: p.variants.length,
        fromPrice: p.variants[0]?.price ?? null,
        fromPriceUnit: p.variants[0]?.saleUnit ?? null,
        inStock: p.variants.some((v) => v.active && v.inStock),
        shippingReady: p.variants
          .filter((v) => v.active)
          .every((v) => v.shippingWeightKg),
      })),
      page: 0,
      size: 20,
      totalElements: found.length,
      totalPages: found.length > 0 ? 1 : 0,
    })
  }),

  http.get(`${API}/api/admin/products/:id`, ({ params }) => {
    const found = products.find((p) => p.id === params.id)
    return (
      requireAdmin() ??
      (found ? apiJson(found) : problem(404, 'Not Found', 'Product not found'))
    )
  }),

  http.post(`${API}/api/admin/products`, async ({ request }) => {
    const denied = requireAdmin()
    if (denied) return denied
    const body = (await request.json()) as ProductInput
    lastProductRequest = body
    const taken = body.variants.filter((v) =>
      products.some((p) => p.variants.some((pv) => pv.sku === v.sku)),
    )
    if (taken.length > 0) {
      return problem(
        409,
        'Conflict',
        `These SKUs are already used: ${taken.map((v) => v.sku).join(', ')}`,
      )
    }
    return apiJson(seedProduct(body), { status: 201 })
  }),

  http.put(`${API}/api/admin/products/:id`, async ({ params, request }) => {
    const denied = requireAdmin()
    if (denied) return denied
    const body = (await request.json()) as ProductInput
    lastProductRequest = body
    const existingImages =
      products.find((p) => p.id === params.id)?.images ?? []
    const updated = {
      ...toDetail(String(params.id), body),
      images: existingImages,
    }
    products = products.map((p) => (p.id === params.id ? updated : p))
    return apiJson(updated)
  }),

  http.delete(`${API}/api/admin/products/:id`, ({ params }) => {
    const denied = requireAdmin()
    if (denied) return denied
    products = products.filter((p) => p.id !== params.id)
    return apiEmpty(204)
  }),

  // ---- images ----

  http.post(
    `${API}/api/admin/products/:id/images`,
    async ({ params, request }) => {
      const denied = requireAdmin()
      if (denied) return denied
      const form = await request.formData()
      // Not `instanceof File`: the test browser (jsdom) and Node.js each have their own
      // File class, so a file made by one is not an "instance" of the other's class.
      const file = form.get('file') as File | string | null
      if (!file || typeof file === 'string')
        return problem(400, 'Bad Request', 'Choose an image file to upload.')
      if (file.name.includes('fake'))
        return problem(400, 'Bad Request', 'Upload a JPEG, PNG or WebP image.')
      const product = products.find((p) => p.id === params.id)
      if (!product) return problem(404, 'Not Found', 'Product not found')
      const image = {
        id: `img-${product.images.length + 1}`,
        url: `https://images.example/${file.name}`,
        altText: (form.get('altText') as string | null) ?? null,
      }
      product.images = [...product.images, image]
      return apiJson(image, { status: 201 })
    },
  ),

  http.delete(`${API}/api/admin/products/:id/images/:imageId`, ({ params }) => {
    const denied = requireAdmin()
    if (denied) return denied
    const product = products.find((p) => p.id === params.id)
    if (!product?.images.some((i) => i.id === params.imageId)) {
      return problem(404, 'Not Found', 'Image not found')
    }
    product.images = product.images.filter((i) => i.id !== params.imageId)
    return apiEmpty(204)
  }),

  http.put(
    `${API}/api/admin/categories/:id/image`,
    async ({ params, request }) => {
      const denied = requireAdmin()
      if (denied) return denied
      const file = (await request.formData()).get('file') as File
      categories = categories.map((c) =>
        c.id === params.id
          ? { ...c, imageUrl: `https://images.example/${file.name}` }
          : c,
      )
      return apiJson(categories.find((c) => c.id === params.id))
    },
  ),

  http.delete(`${API}/api/admin/categories/:id/image`, ({ params }) => {
    const denied = requireAdmin()
    if (denied) return denied
    categories = categories.map((c) =>
      c.id === params.id ? { ...c, imageUrl: null } : c,
    )
    return apiEmpty(204)
  }),
]
