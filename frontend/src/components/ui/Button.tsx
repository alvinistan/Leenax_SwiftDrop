import { LoaderCircle } from 'lucide-react'
import type { ComponentProps } from 'react'
import { cn } from '../../lib/cn'
import { buttonClasses, type ButtonStyleOptions } from './buttonStyles'

// ComponentProps<'button'> includes `ref` (React 19 passes refs as normal props).
type ButtonProps = ComponentProps<'button'> &
  ButtonStyleOptions & {
    /** Shows a spinner and blocks clicks while an action is running. */
    isLoading?: boolean
  }

export function Button({
  variant,
  size,
  isLoading = false,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      // type="button" by default: a plain <button> inside a form would submit it.
      type={type}
      className={cn(buttonClasses({ variant, size }), className)}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...rest}
    >
      {isLoading && (
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      )}
      {children}
    </button>
  )
}
