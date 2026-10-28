import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

/** A white surface with a border and rounded corners. */
export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-slate-200 bg-white',
        className,
      )}
      {...rest}
    />
  )
}
