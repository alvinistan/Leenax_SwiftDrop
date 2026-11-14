import { zodResolver } from '@hookform/resolvers/zod'
import { UserPlus } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { z } from 'zod'
import { Container } from '../components/layout/Container'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { register as registerAccount } from '../features/auth/authApi'
import { useAuth } from '../features/auth/AuthContext'
import { ApiError, userMessage } from '../lib/errors'
import { safeRedirect } from '../lib/safeRedirect'

const registerSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(1, 'Enter your name.')
      .max(100, 'At most 100 characters.'),
    email: z.email('Enter an email address like name@example.com.'),
    password: z
      .string()
      .min(12, 'Use at least 12 characters.')
      .max(128, 'At most 128 characters.'),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'The passwords do not match.',
  })
type RegisterValues = z.infer<typeof registerSchema>

/** Customers create an account to check out (no guest checkout). */
export function RegisterPage() {
  const { auth, logIn } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectTo = safeRedirect(searchParams.get('redirectTo')) ?? '/'
  const [formError, setFormError] = useState<string>()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) })

  if (auth.status === 'authenticated') {
    return <Navigate to={redirectTo} replace />
  }

  async function onSubmit(values: RegisterValues) {
    setFormError(undefined)
    try {
      await registerAccount({
        email: values.email,
        password: values.password,
        displayName: values.displayName,
      })
      await logIn(values.email, values.password)
      navigate(redirectTo, { replace: true })
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setError('email', { message: error.message })
      } else {
        setFormError(userMessage(error))
      }
    }
  }

  return (
    <Container className="flex justify-center py-16">
      <title>Create an account | Leenax SwiftDrop.lk</title>
      <div className="w-full max-w-sm">
        <UserPlus
          className="mx-auto size-10 text-brand-700"
          aria-hidden="true"
        />
        <h1 className="mt-4 text-center text-2xl font-bold text-slate-900">
          Create an account
        </h1>
        <p className="mt-2 text-center text-sm text-slate-600">
          You need an account to place orders and follow them.
        </p>
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
            label="Your name"
            autoComplete="name"
            error={errors.displayName?.message}
            {...register('displayName')}
          />
          <Input
            label="Email address"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            hint="At least 12 characters. A short sentence is easy to remember."
            error={errors.password?.message}
            {...register('password')}
          />
          <Input
            label="Repeat password"
            type="password"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
          <Button
            type="submit"
            size="lg"
            className="w-full"
            isLoading={isSubmitting}
          >
            Create account
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-600">
          Already have an account?{' '}
          <Link
            to={`/login?redirectTo=${encodeURIComponent(redirectTo)}`}
            className="font-semibold text-brand-800 hover:underline"
          >
            Log in
          </Link>
        </p>
      </div>
    </Container>
  )
}
