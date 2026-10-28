import { useId, type InputHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Visible label. Every input needs one for screen readers. */
  label: string
  /** Extra guidance shown under the input. */
  hint?: string
  /** Validation message. When set, the input is marked invalid. */
  error?: string
}

export function Input({
  label,
  hint,
  error,
  className,
  id,
  ...rest
}: InputProps) {
  // useId creates a unique id so the <label> and messages can point at the input.
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
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={cn(
          'h-11 rounded-lg border bg-white px-3 text-slate-900 placeholder:text-slate-400',
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
