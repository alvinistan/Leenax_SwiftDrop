import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation } from 'react-router'
import { z } from 'zod'
import { Container } from '../../components/layout/Container'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useAuth } from '../../features/auth/AuthContext'
import { changePassword } from '../../features/auth/authApi'
import { userMessage } from '../../lib/errors'

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: z
      .string()
      .min(12, 'Use a password of 12 to 128 characters.')
      .max(128, 'Use a password of 12 to 128 characters.'),
    repeat: z.string(),
  })
  .refine((v) => v.newPassword === v.repeat, {
    path: ['repeat'],
    message: 'The two new passwords are not the same.',
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ['newPassword'],
    message: 'Choose a password different from the current one.',
  })
type Values = z.infer<typeof schema>

/** /account/password: any logged-in user (owner, staff, customer) changes their password. */
export function ChangePasswordPage() {
  const { auth } = useAuth()
  const location = useLocation()
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string>()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', repeat: '' },
  })

  if (auth.status === 'loading') {
    return (
      <p role="status" className="p-8 text-center text-slate-600">
        Checking your login…
      </p>
    )
  }
  if (auth.status === 'anonymous') {
    return (
      <Navigate
        to={`/login?redirectTo=${encodeURIComponent(location.pathname)}`}
        replace
      />
    )
  }

  async function onSubmit(v: Values) {
    setError(undefined)
    setDone(false)
    try {
      await changePassword(v.currentPassword, v.newPassword)
      reset()
      setDone(true)
    } catch (e) {
      setError(userMessage(e))
    }
  }

  return (
    <Container className="flex justify-center py-12">
      <title>Change password | Leenax SwiftDrop.lk</title>
      <div className="w-full max-w-sm">
        <Link
          to={
            auth.user.roles.includes('ADMIN')
              ? '/admin'
              : auth.user.roles.includes('DELIVERY')
                ? '/delivery'
                : '/account/orders'
          }
          className="text-sm font-medium text-brand-800 hover:underline"
        >
          ← Back
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">
          Change password
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          For {auth.user.email}. Use at least 12 characters; a few unrelated
          words make a strong password that is easy to remember.
        </p>
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="mt-6 space-y-5"
        >
          {done && (
            <p
              role="status"
              className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3 font-medium text-emerald-900"
            >
              <CheckCircle2
                className="mt-0.5 size-5 shrink-0"
                aria-hidden="true"
              />
              Your password has been changed.
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800"
            >
              {error}
            </p>
          )}
          <Input
            type="password"
            label="Current password"
            autoComplete="current-password"
            error={errors.currentPassword?.message}
            {...register('currentPassword')}
          />
          <Input
            type="password"
            label="New password"
            autoComplete="new-password"
            error={errors.newPassword?.message}
            {...register('newPassword')}
          />
          <Input
            type="password"
            label="Repeat new password"
            autoComplete="new-password"
            error={errors.repeat?.message}
            {...register('repeat')}
          />
          <Button type="submit" className="w-full" isLoading={isSubmitting}>
            Change password
          </Button>
        </form>
      </div>
    </Container>
  )
}
