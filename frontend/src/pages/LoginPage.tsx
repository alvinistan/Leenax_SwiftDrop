import { zodResolver } from '@hookform/resolvers/zod'
import { LockKeyhole } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { z } from 'zod'
import { Container } from '../components/layout/Container'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { isAdmin, useAuth } from '../features/auth/AuthContext'
import { ApiError, userMessage } from '../lib/errors'

const loginSchema = z.object({
  email: z.email('Enter an email address like name@example.com.'),
  password: z.string().min(1, 'Enter your password.'),
})
type LoginValues = z.infer<typeof loginSchema>

/** Only allow redirects to pages on this site (never to another website). */
function safeRedirect(target: string | null): string {
  return target && target.startsWith('/') && !target.startsWith('//')
    ? target
    : '/admin'
}

export function LoginPage() {
  const { auth, logIn } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectTo = safeRedirect(searchParams.get('redirectTo'))
  const [formError, setFormError] = useState<string>()

  // React Hook Form: tracks values, validates with the Zod schema, and only
  // calls onSubmit when everything is valid.
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })

  if (isAdmin(auth)) {
    return <Navigate to={redirectTo} replace />
  }

  async function onSubmit(values: LoginValues) {
    setFormError(undefined)
    try {
      await logIn(values.email, values.password)
      navigate(redirectTo, { replace: true })
    } catch (error) {
      // 401: the server does not say whether the email or the password was wrong,
      // so an attacker cannot find out which emails have accounts.
      setFormError(
        error instanceof ApiError && error.status === 401
          ? 'The email or password is incorrect.'
          : userMessage(error),
      )
    }
  }

  return (
    <Container className="flex justify-center py-16">
      <title>Log in | Leenax SwiftDrop.lk</title>
      <div className="w-full max-w-sm">
        <LockKeyhole
          className="mx-auto size-10 text-brand-700"
          aria-hidden="true"
        />
        <h1 className="mt-4 text-center text-2xl font-bold text-slate-900">
          Admin log in
        </h1>

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="mt-8 space-y-5"
        >
          {formError && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800"
            >
              {formError}
            </p>
          )}
          <Input
            label="Email address"
            type="email"
            autoComplete="username"
            error={errors.email?.message}
            {...register('email')}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register('password')}
          />
          <Button
            type="submit"
            size="lg"
            className="w-full"
            isLoading={isSubmitting}
          >
            Log in
          </Button>
        </form>
      </div>
    </Container>
  )
}
