import { useId, type InputHTMLAttributes } from 'react'

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string
  hint?: string
}

export function Checkbox({ label, hint, id, ...rest }: CheckboxProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const hintId = `${inputId}-hint`

  return (
    <div className="flex items-start gap-3">
      <input
        id={inputId}
        type="checkbox"
        aria-describedby={hint ? hintId : undefined}
        className="mt-0.5 size-5 rounded border-slate-300 accent-brand-700"
        {...rest}
      />
      <div>
        <label htmlFor={inputId} className="font-medium text-slate-800">
          {label}
        </label>
        {hint && (
          <p id={hintId} className="text-sm text-slate-500">
            {hint}
          </p>
        )}
      </div>
    </div>
  )
}
