import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { ApiError } from '../../lib/errors'

/**
 * Shows the server's field messages (400 "Validation failed") next to the
 * matching inputs. Returns true when at least one field message was shown.
 */
export function applyFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
): boolean {
  if (!(error instanceof ApiError) || error.fieldErrors.length === 0) {
    return false
  }
  for (const { field, message } of error.fieldErrors) {
    // "bands[1].price" → "bands.1.price" (React Hook Form path)
    setError(field.replace(/\[(\d+)\]/g, '.$1') as Path<T>, { message })
  }
  return true
}
