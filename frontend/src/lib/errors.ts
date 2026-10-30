/** One invalid field from a 400 "Validation failed" response. */
export type FieldError = { field: string; message: string }

/**
 * Any failed API request, in one shape the UI can rely on. Built from the
 * backend's RFC 9457 problem JSON: { title, status, detail, errors? }.
 */
export class ApiError extends Error {
  /** HTTP status; 0 means the server could not be reached at all. */
  readonly status: number
  readonly title: string
  readonly fieldErrors: FieldError[]

  constructor(
    status: number,
    title: string,
    detail: string,
    fieldErrors: FieldError[] = [],
  ) {
    super(detail)
    this.name = 'ApiError'
    this.status = status
    this.title = title
    this.fieldErrors = fieldErrors
  }
}

/** The requested item does not exist (HTTP 404). Pages show a "not found" message for it. */
export class NotFoundError extends ApiError {
  constructor(detail: string) {
    super(404, 'Not Found', detail)
    this.name = 'NotFoundError'
  }
}

/** A message that is safe and helpful to show to customers. */
export function userMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0) {
      return "We couldn't reach the store. Please check your internet connection and try again."
    }
    if (error.status >= 500) {
      return 'The store is having a problem right now. Please try again in a moment.'
    }
    return error.message
  }
  return 'Something went wrong. Please try again.'
}
