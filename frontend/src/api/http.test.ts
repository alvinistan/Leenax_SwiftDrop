import { http as mock, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { listProducts } from '../features/catalog/catalogApi'
import { ApiError, NotFoundError, userMessage } from '../lib/errors'
import { API, apiJson, server } from '../test/mockApi'
import { http } from './http'

/** Runs a request and returns the error it rejects with. */
async function errorOf(request: Promise<unknown>): Promise<unknown> {
  try {
    await request
  } catch (error) {
    return error
  }
  throw new Error('Expected the request to fail')
}

describe('Axios instance and error interceptor', () => {
  it('turns a 400 problem response into an ApiError with field errors', async () => {
    server.use(
      mock.post(`${API}/api/test`, () =>
        apiJson(
          {
            title: 'Validation failed',
            status: 400,
            detail: 'One or more fields are invalid.',
            errors: [{ field: 'name', message: 'Name is required.' }],
          },
          { status: 400 },
        ),
      ),
    )

    const error = await errorOf(http.post('/api/test', {}))

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 400,
      title: 'Validation failed',
      message: 'One or more fields are invalid.',
      fieldErrors: [{ field: 'name', message: 'Name is required.' }],
    })
  })

  it('turns a 404 into NotFoundError', async () => {
    const error = await errorOf(http.get('/api/products/no-such-product'))

    expect(error).toBeInstanceOf(NotFoundError)
  })

  it('reports an unreachable server as status 0 with a friendly message', async () => {
    server.use(mock.get(`${API}/api/categories`, () => HttpResponse.error()))

    const error = await errorOf(http.get('/api/categories'))

    expect(error).toMatchObject({ status: 0 })
    expect(userMessage(error)).toMatch(/couldn't reach the store/)
  })

  it('never shows server error details to customers', async () => {
    server.use(
      mock.get(`${API}/api/categories`, () =>
        apiJson({ detail: 'NullPointerException at line 42' }, { status: 500 }),
      ),
    )

    const error = await errorOf(http.get('/api/categories'))

    expect(userMessage(error)).toBe(
      'The store is having a problem right now. Please try again in a moment.',
    )
  })
})

describe('catalogApi', () => {
  it('sends the filters as query parameters the backend understands', async () => {
    let requested: URL | undefined
    server.use(
      mock.get(`${API}/api/products`, ({ request }) => {
        requested = new URL(request.url)
        return apiJson({
          content: [],
          page: 1,
          size: 8,
          totalElements: 0,
          totalPages: 0,
        })
      }),
    )

    await listProducts({ categorySlug: 'cakes-bakery', page: 1, sort: 'name' })

    expect(requested?.searchParams.get('category')).toBe('cakes-bakery')
    expect(requested?.searchParams.get('page')).toBe('1')
    expect(requested?.searchParams.get('size')).toBe('8')
    expect(requested?.searchParams.get('sort')).toBe('name,asc')
  })

  it('cancels a request when its AbortSignal is aborted', async () => {
    const controller = new AbortController()
    const request = listProducts({}, controller.signal)
    controller.abort()

    const error = await errorOf(request)

    // A cancellation is NOT turned into an ApiError: it is not a failure to show.
    expect(error).not.toBeInstanceOf(ApiError)
  })
})
