import { http } from 'msw'
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

let loggedIn = false
let categories: Category[] = []

export function resetMockAdmin() {
  loggedIn = false
  categories = []
}

/** Starts a test already logged in as the admin. */
export function logInMockAdmin() {
  loggedIn = true
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
  loggedIn ? null : problem(401, 'Unauthorized', 'Please log in to continue.')

export const adminHandlers = [
  // CORS preflight for every API path
  http.options(`${API}/api/*`, () => apiPreflight()),

  http.get(`${API}/api/auth/me`, () =>
    loggedIn
      ? apiJson({
          email: ADMIN.email,
          displayName: 'Administrator',
          roles: ['ADMIN'],
        })
      : problem(401, 'Unauthorized', 'Please log in to continue.'),
  ),

  http.post(`${API}/api/auth/login`, async ({ request }) => {
    const form = new URLSearchParams(await request.text())
    if (
      form.get('email')?.toLowerCase() === ADMIN.email &&
      form.get('password') === ADMIN.password
    ) {
      loggedIn = true
      return apiEmpty(204)
    }
    return problem(401, 'Unauthorized', 'The email or password is incorrect.')
  }),

  http.post(`${API}/api/auth/logout`, () => {
    loggedIn = false
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
]
