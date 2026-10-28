import { cn } from '../../lib/cn'

/** A grey placeholder block shown while content is loading. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-slate-200', className)}
    />
  )
}
