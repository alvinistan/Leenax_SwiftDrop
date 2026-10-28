import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { NotifyMeForm } from './NotifyMeForm'

describe('NotifyMeForm', () => {
  it('asks for an email when submitted empty', async () => {
    render(<NotifyMeForm />)

    await userEvent.click(screen.getByRole('button', { name: 'Notify me' }))

    expect(screen.getByLabelText('Email address')).toHaveAccessibleDescription(
      'Enter your email address.',
    )
  })

  it('rejects an invalid email, then clears the error once it is fixed', async () => {
    render(<NotifyMeForm />)
    const input = screen.getByLabelText('Email address')

    await userEvent.type(input, 'not-an-email')
    await userEvent.click(screen.getByRole('button', { name: 'Notify me' }))
    expect(input).toHaveAttribute('aria-invalid', 'true')

    await userEvent.clear(input)
    await userEvent.type(input, 'name@example.com')
    expect(input).not.toHaveAttribute('aria-invalid')
  })

  it('shows an honest confirmation for a valid email', async () => {
    render(<NotifyMeForm />)

    await userEvent.type(
      screen.getByLabelText('Email address'),
      'name@example.com',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Notify me' }))

    expect(screen.getByRole('status')).toHaveTextContent(
      'was not sent or saved',
    )
  })
})
