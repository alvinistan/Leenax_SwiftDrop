import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Input } from './Input'

describe('Input', () => {
  it('is reachable by its label', () => {
    render(<Input label="Email address" />)

    expect(screen.getByLabelText('Email address')).toBeInTheDocument()
  })

  it('announces the error message and marks the input invalid', () => {
    render(<Input label="Email address" error="Enter a valid email address." />)

    const input = screen.getByLabelText('Email address')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Enter a valid email address.')
  })
})
