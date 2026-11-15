import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import {
  createStaff,
  listStaff,
  resetStaffPassword,
  setStaffEnabled,
  type DeliveryStaff,
} from '../../../features/delivery/deliveryApi'
import { applyFieldErrors } from '../../../features/shipping/applyFieldErrors'
import {
  StatusMessage,
  type Message,
} from '../../../features/shipping/StatusMessage'
import { useAsync } from '../../../hooks/useAsync'
import { userMessage } from '../../../lib/errors'

const password = z
  .string()
  .min(12, 'Use a password of 12 to 128 characters.')
  .max(128, 'Use a password of 12 to 128 characters.')

const staffSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Name is required.')
    .max(100, 'At most 100 characters.'),
  email: z.email('Enter an email address like name@example.com.'),
  password,
})
type StaffValues = z.infer<typeof staffSchema>

/**
 * /admin/delivery/staff: accounts for the people who deliver nearby orders.
 * They log in at the normal login page and see only their own deliveries.
 */
export function DeliveryStaffPage() {
  const { state, retry } = useAsync(
    (signal) => listStaff(signal),
    'delivery-staff',
  )
  const [changed, setChanged] = useState<DeliveryStaff[]>([])
  const staff =
    state.status === 'success'
      ? [
          ...state.data.map((s) => changed.find((c) => c.id === s.id) ?? s),
          ...changed.filter((c) => !state.data.some((s) => s.id === c.id)),
        ]
      : []

  function remember(s: DeliveryStaff) {
    setChanged((list) => [...list.filter((c) => c.id !== s.id), s])
  }

  return (
    <>
      <title>Delivery staff | Admin</title>
      <h1 className="text-2xl font-bold text-slate-900">Delivery staff</h1>
      <p className="mt-1 max-w-3xl text-sm text-slate-600">
        People who deliver nearby orders for you. They log in on the normal
        login page and see only the parcels you give them, with the
        customer&apos;s address and phone until the parcel is delivered.
      </p>

      <div className="mt-6">
        {state.status === 'loading' && (
          <p className="text-slate-600">Loading…</p>
        )}
        {state.status === 'error' && (
          <ErrorState description={userMessage(state.error)} onRetry={retry} />
        )}
        {state.status === 'success' && staff.length === 0 && (
          <p className="text-slate-600">No delivery staff yet.</p>
        )}
        {staff.length > 0 && (
          <ul className="space-y-3">
            {staff.map((s) => (
              <StaffRow key={s.id} staff={s} onChanged={remember} />
            ))}
          </ul>
        )}
      </div>

      <NewStaffForm onCreated={remember} />
    </>
  )
}

function StaffRow({
  staff,
  onChanged,
}: {
  staff: DeliveryStaff
  onChanged: (s: DeliveryStaff) => void
}) {
  const [message, setMessage] = useState<Message>()
  const [isSaving, setIsSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function toggle() {
    setIsSaving(true)
    setMessage(undefined)
    try {
      const saved = await setStaffEnabled(staff.id, !staff.enabled)
      onChanged(saved)
      setMessage({
        tone: 'success',
        text: saved.enabled
          ? `${saved.displayName} can log in again.`
          : `${saved.displayName} can no longer log in.`,
      })
    } catch (e) {
      setMessage({ tone: 'error', text: userMessage(e) })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <li>
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
              {staff.displayName}
              {staff.enabled ? (
                <Badge tone="success">Active</Badge>
              ) : (
                <Badge>Disabled</Badge>
              )}
            </p>
            <p className="text-sm text-slate-600">
              {staff.email} · {staff.activeDeliveries} to deliver
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowPassword((v) => !v)}
            >
              Set new password
            </Button>
            <Button variant="secondary" onClick={toggle} isLoading={isSaving}>
              {staff.enabled ? 'Disable' : 'Enable'}
            </Button>
          </div>
        </div>
        {showPassword && (
          <PasswordForm
            staff={staff}
            onDone={(text) => {
              setShowPassword(false)
              setMessage({ tone: 'success', text })
            }}
          />
        )}
        <StatusMessage message={message} className="mt-3" />
      </Card>
    </li>
  )
}

function PasswordForm({
  staff,
  onDone,
}: {
  staff: DeliveryStaff
  onDone: (message: string) => void
}) {
  const [error, setFormError] = useState<string>()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ password: string }>({
    resolver: zodResolver(z.object({ password })),
    defaultValues: { password: '' },
  })

  async function onSubmit(v: { password: string }) {
    setFormError(undefined)
    try {
      await resetStaffPassword(staff.id, v.password)
      onDone(
        `New password saved for ${staff.displayName}. Tell them in person.`,
      )
    } catch (e) {
      setFormError(userMessage(e))
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="mt-3 flex flex-wrap items-end gap-3"
    >
      <Input
        type="password"
        label={`New password for ${staff.displayName}`}
        autoComplete="new-password"
        error={errors.password?.message ?? error}
        {...register('password')}
      />
      <Button type="submit" isLoading={isSubmitting}>
        Save password
      </Button>
    </form>
  )
}

function NewStaffForm({
  onCreated,
}: {
  onCreated: (s: DeliveryStaff) => void
}) {
  const [message, setMessage] = useState<Message>()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<StaffValues>({
    resolver: zodResolver(staffSchema),
    defaultValues: { displayName: '', email: '', password: '' },
  })

  async function onSubmit(v: StaffValues) {
    setMessage(undefined)
    try {
      const created = await createStaff(v)
      onCreated(created)
      reset()
      setMessage({
        tone: 'success',
        text: `${created.displayName} added. They log in with ${created.email} and the password you chose.`,
      })
    } catch (e) {
      if (!applyFieldErrors(e, setError)) {
        setMessage({ tone: 'error', text: userMessage(e) })
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8">
      <fieldset className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
        <legend className="px-1 font-semibold text-slate-900">
          Add a staff member
        </legend>
        <Input
          label="Name"
          error={errors.displayName?.message}
          {...register('displayName')}
        />
        <Input
          type="email"
          label="Email (their login)"
          autoComplete="off"
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          type="password"
          label="Password"
          hint="At least 12 characters. Tell them in person, not by message."
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <div className="sm:col-span-3">
          <StatusMessage message={message} className="mb-3" />
          <Button type="submit" isLoading={isSubmitting}>
            Add staff member
          </Button>
        </div>
      </fieldset>
    </form>
  )
}
