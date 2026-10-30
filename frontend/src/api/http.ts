import axios, { AxiosError } from 'axios'
import { ApiError, NotFoundError, type FieldError } from '../lib/errors'

/** The backend's error body (RFC 9457 problem details), as sent by GlobalExceptionHandler. */
type ProblemDetail = {
  title?: string
  status?: number
  detail?: string
  errors?: FieldError[]
}

/**
 * The single Axios instance the whole app uses. Configured once:
 * where the API is, how long to wait, and how to turn errors into ApiError.
 */
export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8080',
  // Give up after 10 seconds instead of spinning forever.
  timeout: 10_000,
  headers: { Accept: 'application/json' },
})

/**
 * Converts every Axios failure into an ApiError (or NotFoundError), so pages
 * never have to understand Axios internals. Cancelled requests pass through
 * unchanged: they are not errors, the user simply moved on.
 */
export function toApiError(error: unknown): unknown {
  if (axios.isCancel(error) || !(error instanceof AxiosError)) {
    return error
  }
  if (!error.response) {
    // No response at all: server down, wrong URL, offline, timeout, or blocked by CORS.
    return new ApiError(0, 'Network error', error.message)
  }
  const problem = (error.response.data ?? {}) as ProblemDetail
  const status = error.response.status
  const detail =
    problem.detail ?? problem.title ?? `Request failed with status ${status}.`
  if (status === 404) {
    return new NotFoundError(detail)
  }
  return new ApiError(
    status,
    problem.title ?? 'Error',
    detail,
    problem.errors ?? [],
  )
}

// An interceptor runs for every response. Success: pass it on. Failure: convert it.
http.interceptors.response.use(
  (response) => response,
  (error: unknown) => Promise.reject(toApiError(error)),
)
