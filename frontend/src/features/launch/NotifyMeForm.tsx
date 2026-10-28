import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateEmail(value: string): string | undefined {
  if (value.trim() === '') return 'Enter your email address.'
  if (!EMAIL_PATTERN.test(value.trim())) {
    return 'Enter an email address like name@example.com.'
  }
  return undefined
}

/**
 * A controlled form: React state holds the input value, and the input
 * always shows that state. This makes validation straightforward.
 *
 * PREVIEW ONLY: nothing is sent or stored yet (there is no backend for it).
 */
export function NotifyMeForm() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string>()
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [isDone, setIsDone] = useState(false)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Stop the browser's default full-page form submission.
    event.preventDefault()
    setHasSubmitted(true)

    const validationError = validateEmail(email)
    setError(validationError)
    if (!validationError) setIsDone(true)
  }

  if (isDone) {
    return (
      <p
        role="status"
        className="rounded-lg bg-brand-50 p-4 font-medium text-brand-900"
      >
        Thank you! This is a preview, so your email was not sent or saved.
      </p>
    )
  }

  return (
    // noValidate: use our friendly messages instead of the browser's built-in ones.
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-4 sm:flex-row sm:items-start"
    >
      <div className="flex-1">
        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          value={email}
          error={error}
          onChange={(event) => {
            setEmail(event.target.value)
            // After the first submit, re-check as the user types so errors clear quickly.
            if (hasSubmitted) setError(validateEmail(event.target.value))
          }}
        />
      </div>
      <Button type="submit" size="md" className="sm:mt-7">
        Notify me
      </Button>
    </form>
  )
}
