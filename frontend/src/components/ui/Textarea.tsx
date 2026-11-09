import { useId, type TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string
  hint?: string
  error?: string
}

/** Multi-line text input with the same label/hint/error wiring as Input. */
export function Textarea({
  label,
  hint,
  error,
  className,
  id,
  ...rest
}: TextareaProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const hintId = `${inputId}-hint`
  const errorId = `${inputId}-error`
  const describedBy = [hint && hintId, error && errorId]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-slate-800">
        {label}
      </label>
      <textarea
        id={inputId}
        rows={4}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={cn(
          'rounded-lg border bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400',
          error ? 'border-red-600' : 'border-slate-300',
          className,
        )}
        {...rest}
      />
      {hint && (
        <p id={hintId} className="text-sm text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
