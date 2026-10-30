import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import type { ProductSort } from '../features/catalog/catalogApi'
import {
  sampleGetProduct,
  sampleListCategories,
  sampleListProducts,
} from '../features/catalog/sampleCatalog'
import { NotFoundError } from '../lib/errors'

/**
 * A fake backend for tests, using MSW (Mock Service Worker). It intercepts the
 * HTTP requests Axios makes and answers like the Spring Boot API would, using
 * the sample catalogue. Tests therefore exercise the real Axios code.
 */
export const API = 'http://localhost:8080'

/** The test page pretends to be the Vite dev server (see vite.config.ts). */
export const FRONTEND_ORIGIN = 'http://localhost:5173'

/**
 * A JSON response with the CORS header the real backend sends (CorsConfig).
 * Without it, jsdom blocks the response, exactly like a real browser would.
 */
export function apiJson(body: unknown, init: ResponseInit = {}) {
  return HttpResponse.json(body as never, {
    ...init,
    headers: {
      'Access-Control-Allow-Origin': FRONTEND_ORIGIN,
      ...init.headers,
    },
  })
}

export const handlers = [
  http.get(`${API}/api/categories`, async () =>
    apiJson(await sampleListCategories()),
  ),

  http.get(`${API}/api/products`, async ({ request }) => {
    const params = new URL(request.url).searchParams
    const sortField = (params.get('sort') ?? 'createdAt,desc').split(',')[0]
    const page = await sampleListProducts({
      categorySlug: params.get('category') ?? undefined,
      page: Number(params.get('page') ?? 0),
      size: Number(params.get('size') ?? 20),
      sort: (sortField === 'name' ? 'name' : 'newest') satisfies ProductSort,
    })
    return apiJson(page)
  }),

  http.get(`${API}/api/products/:slug`, async ({ params }) => {
    try {
      return apiJson(await sampleGetProduct(String(params.slug)))
    } catch (error) {
      if (!(error instanceof NotFoundError)) throw error
      // The same problem JSON the backend's GlobalExceptionHandler sends
      return apiJson(
        {
          title: 'Not Found',
          status: 404,
          detail: `Product not found: ${params.slug}`,
        },
        {
          status: 404,
          headers: { 'Content-Type': 'application/problem+json' },
        },
      )
    }
  }),
]

export const server = setupServer(...handlers)
