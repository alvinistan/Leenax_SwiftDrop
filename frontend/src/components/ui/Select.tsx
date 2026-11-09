import { useId, type ComponentProps } from 'react'
import { cn } from '../../lib/cn'

type SelectProps = ComponentProps<'select'> & {
  label: string
  hint?: string
  error?: string
}

/** A dropdown with the same label/hint/error wiring as Input. */
export function Select({
  label,
  hint,
  error,
  className,
  id,
  children,
  ...rest
}: SelectProps) {
  const generatedId = useId()
  const selectId = id ?? generatedId
  const hintId = `${selectId}-hint`
  const errorId = `${selectId}-error`
  const describedBy = [hint && hintId, error && errorId]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={selectId} className="text-sm font-medium text-slate-800">
        {label}
      </label>
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={cn(
          'h-11 rounded-lg border bg-white px-3 text-slate-900',
          error ? 'border-red-600' : 'border-slate-300',
          className,
        )}
        {...rest}
      >
        {children}
      </select>
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
