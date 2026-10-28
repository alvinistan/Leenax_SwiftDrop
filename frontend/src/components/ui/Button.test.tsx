import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button'

describe('Button', () => {
  it('calls onClick when clicked', async () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Save</Button>)

    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(handleClick).toHaveBeenCalledOnce()
  })

  it('is disabled and ignores clicks while loading', async () => {
    const handleClick = vi.fn()
    render(
      <Button isLoading onClick={handleClick}>
        Save
      </Button>,
    )

    const button = screen.getByRole('button', { name: 'Save' })
    await userEvent.click(button)

    expect(button).toBeDisabled()
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('does not submit forms unless asked to', () => {
    render(<Button>Cancel</Button>)

    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })
})
