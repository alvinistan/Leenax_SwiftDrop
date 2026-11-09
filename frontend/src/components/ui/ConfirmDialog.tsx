import { TriangleAlert } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'
import { Button } from './Button'

type ConfirmDialogProps = {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  /** Shows a spinner on the confirm button while the action runs. */
  isWorking?: boolean
}

/**
 * Asks "are you sure?" before a destructive action (e.g. deleting).
 *
 * Accessibility: role="alertdialog" + aria-modal tell screen readers this is a
 * dialog needing an answer. Focus starts on "Cancel" (the safe choice), Tab
 * stays inside the dialog, Escape cancels, and focus returns to where it was.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  isWorking = false,
}: ConfirmDialogProps) {
  const titleId = useId()
  const messageId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    cancelRef.current?.focus()
    return () => previouslyFocused?.focus()
  }, [open])

  if (!open) return null

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape' && !isWorking) {
      onCancel()
      return
    }
    if (event.key === 'Tab') {
      // Keep keyboard focus inside the dialog ("focus trap").
      const buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>(
        'button:not(:disabled)',
      )
      if (!buttons || buttons.length === 0) return
      const first = buttons[0]
      const last = buttons[buttons.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        onKeyDown={handleKeyDown}
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
      >
        <div className="flex gap-4">
          <TriangleAlert
            className="size-6 shrink-0 text-red-700"
            aria-hidden="true"
          />
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-slate-900">
              {title}
            </h2>
            <p id={messageId} className="mt-2 text-slate-600">
              {message}
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button
            ref={cancelRef}
            variant="secondary"
            onClick={onCancel}
            disabled={isWorking}
          >
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} isLoading={isWorking}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
