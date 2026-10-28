import { TriangleAlert } from 'lucide-react'
import { Button } from './Button'

type ErrorStateProps = {
  title?: string
  description?: string
  onRetry?: () => void
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'Please try again. If the problem continues, come back a little later.',
  onRetry,
}: ErrorStateProps) {
  return (
    // role="alert" makes screen readers announce the error immediately.
    <div
      role="alert"
      className="flex flex-col items-center rounded-xl border border-red-200 bg-red-50 px-6 py-12 text-center"
    >
      <TriangleAlert className="size-10 text-red-700" aria-hidden="true" />
      <h3 className="mt-4 text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 max-w-sm text-slate-700">{description}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-6" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
