import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

/** Centers content and keeps consistent side padding on every screen size. */
export function Container({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn('mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8', className)}
    >
      {children}
    </div>
  )
}
