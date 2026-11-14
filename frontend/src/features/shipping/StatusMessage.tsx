import { cn } from '../../lib/cn'

export type Message = { tone: 'success' | 'error'; text: string }

/** A success (status) or error (alert) line, announced by screen readers. */
export function StatusMessage({
  message,
  className,
}: {
  message?: Message
  className?: string
}) {
  if (!message) return null
  return (
    <p
      role={message.tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'rounded-lg p-3 text-sm font-medium',
        message.tone === 'error'
          ? 'bg-red-50 text-red-800'
          : 'bg-brand-50 text-brand-900',
        className,
      )}
    >
      {message.text}
    </p>
  )
}
