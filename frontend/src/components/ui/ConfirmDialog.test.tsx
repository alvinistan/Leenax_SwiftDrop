import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

function renderDialog(onCancel = vi.fn(), onConfirm = vi.fn()) {
  render(
    <ConfirmDialog
      open
      title="Delete category?"
      message="This cannot be undone."
      confirmLabel="Delete"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  )
  return { onCancel, onConfirm }
}

describe('ConfirmDialog', () => {
  it('is announced as a dialog and starts on the safe choice', () => {
    renderDialog()

    expect(
      screen.getByRole('alertdialog', { name: 'Delete category?' }),
    ).toHaveAccessibleDescription('This cannot be undone.')
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
  })

  it('cancels with Escape and confirms with the button', async () => {
    const { onCancel, onConfirm } = renderDialog()

    await userEvent.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledOnce()

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('keeps keyboard focus inside the dialog', async () => {
    renderDialog()

    await userEvent.tab() // Cancel → Delete
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveFocus()
    await userEvent.tab() // Delete → back to Cancel, not out of the dialog
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
  })
})
