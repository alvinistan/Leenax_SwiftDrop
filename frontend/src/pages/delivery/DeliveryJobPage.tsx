import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Banknote, CheckCircle2, Phone } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useParams } from 'react-router'
import { z } from 'zod'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Checkbox } from '../../components/ui/Checkbox'
import { ErrorState } from '../../components/ui/ErrorState'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import {
  getMyJob,
  updateJob,
  type DeliveryJob,
  type JobUpdate,
} from '../../features/delivery/deliveryApi'
import { formatDateTime } from '../../features/shipping/dates'
import {
  FAILURE_REASON_LABELS,
  FAILURE_REASONS,
  type FailureReason,
} from '../../features/shipping/shippingApi'
import { TrackingStatusBadge } from '../../features/shipping/TrackingStatusBadge'
import { useAsync } from '../../hooks/useAsync'
import { userMessage } from '../../lib/errors'
import { formatMoney } from '../../lib/money'

/** /delivery/:id: one parcel, with the customer's address and the actions. */
export function DeliveryJobPage() {
  const { id = '' } = useParams()
  const { state, retry } = useAsync(
    (signal) => getMyJob(id, signal),
    `job-${id}`,
  )
  const [updated, setUpdated] = useState<DeliveryJob>()
  // Delivered: the parcel leaves this person's list (and the address with it).
  const [done, setDone] = useState<string>()
  const job = updated ?? (state.status === 'success' ? state.data : undefined)

  return (
    <>
      <title>{`Delivery ${job?.orderNumber ?? ''} | Leenax SwiftDrop.lk`}</title>
      <Link
        to="/delivery"
        className="inline-flex items-center gap-1 text-sm font-medium text-brand-800 hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> My deliveries
      </Link>
      {done ? (
        <p
          role="status"
          className="mt-6 flex items-start gap-2 rounded-lg bg-emerald-50 p-4 font-medium text-emerald-900"
        >
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          {done}
        </p>
      ) : (
        <>
          {state.status === 'loading' && (
            <p className="mt-6 text-slate-600">Loading…</p>
          )}
          {state.status === 'error' && (
            <div className="mt-6">
              <ErrorState
                description={userMessage(state.error)}
                onRetry={retry}
              />
            </div>
          )}
          {job && (
            <Job
              job={job}
              onUpdated={setUpdated}
              onDelivered={(message) => setDone(message)}
            />
          )}
        </>
      )}
    </>
  )
}

function Job({
  job,
  onUpdated,
  onDelivered,
}: {
  job: DeliveryJob
  onUpdated: (job: DeliveryJob) => void
  onDelivered: (message: string) => void
}) {
  const [error, setError] = useState<string>()
  const [isStarting, setIsStarting] = useState(false)
  const [mode, setMode] = useState<'delivered' | 'failed'>()

  async function send(update: JobUpdate) {
    setError(undefined)
    return updateJob(job.id, update)
  }

  async function start() {
    setIsStarting(true)
    try {
      onUpdated(await send({ action: 'START' }))
    } catch (e) {
      setError(userMessage(e))
    } finally {
      setIsStarting(false)
    }
  }

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold text-slate-900">
          {job.recipientName ?? job.orderNumber}
        </h1>
        <TrackingStatusBadge status={job.status} />
      </div>
      <p className="text-sm text-slate-600">
        Order {job.orderNumber} · {job.reference}
      </p>

      {job.cashToCollect && (
        <p className="mt-4 flex items-center gap-2 rounded-lg bg-amber-50 p-4 text-lg font-semibold text-amber-900">
          <Banknote className="size-6 shrink-0" aria-hidden="true" />
          Collect {formatMoney(job.cashToCollect)} in cash
        </p>
      )}
      {job.alreadyPaid && (
        <p className="mt-4 rounded-lg bg-emerald-50 p-3 font-medium text-emerald-900">
          Already paid: do not collect money.
        </p>
      )}

      <Card className="mt-4 p-4">
        <h2 className="font-semibold text-slate-900">Deliver to</h2>
        {job.line1 ? (
          <address className="mt-1 not-italic text-slate-800">
            {job.recipientName}
            <br />
            {job.line1}
            {job.line2 && (
              <>
                <br />
                {job.line2}
              </>
            )}
            <br />
            {[job.city, job.region, job.postalCode].filter(Boolean).join(', ')}
          </address>
        ) : (
          <p className="mt-1 text-slate-700">
            {job.city ?? 'Ask the owner for the address.'}
          </p>
        )}
        {job.phone && (
          <a
            href={`tel:${job.phone.replace(/[^\d+]/g, '')}`}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2 font-semibold text-white hover:bg-brand-800"
          >
            <Phone className="size-4" aria-hidden="true" /> Call {job.phone}
          </a>
        )}
        {job.customerNote && (
          <p className="mt-3 rounded-lg bg-slate-100 p-3 text-sm text-slate-800">
            Customer&apos;s note: {job.customerNote}
          </p>
        )}
      </Card>

      {job.items.length > 0 && (
        <Card className="mt-4 p-4">
          <h2 className="font-semibold text-slate-900">In the parcel</h2>
          <ul className="mt-1 space-y-1 text-slate-800">
            {job.items.map((item, i) => (
              <li key={i}>
                {item.quantity}
                {item.saleUnit === 'KG' ? ' kg' : ' ×'} {item.productName}
                {item.variantLabel && ` (${item.variantLabel})`}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {job.failedAttempts.length > 0 && (
        <Card className="mt-4 p-4">
          <h2 className="font-semibold text-slate-900">Earlier attempts</h2>
          <ul className="mt-1 space-y-1 text-sm text-slate-700">
            {job.failedAttempts.map((a, i) => (
              <li key={i}>
                {formatDateTime(a.at)}: {a.reason}
                {a.note && ` · ${a.note}`}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {error && (
        <p role="alert" className="mt-4 text-red-700">
          {error}
        </p>
      )}

      <div className="mt-6 space-y-3">
        {job.canStart && (
          <Button className="w-full" onClick={start} isLoading={isStarting}>
            Start delivery
          </Button>
        )}
        {job.canFinish && !mode && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Button onClick={() => setMode('delivered')}>Delivered</Button>
            <Button variant="secondary" onClick={() => setMode('failed')}>
              Could not deliver
            </Button>
          </div>
        )}
        {mode === 'delivered' && (
          <DeliveredForm
            job={job}
            send={send}
            onCancel={() => setMode(undefined)}
            onDone={() =>
              onDelivered(
                `Order ${job.orderNumber} delivered.${job.cashToCollect ? ` Hand the ${formatMoney(job.cashToCollect)} to the owner.` : ''}`,
              )
            }
            onError={setError}
          />
        )}
        {mode === 'failed' && (
          <FailedForm
            send={send}
            onCancel={() => setMode(undefined)}
            onDone={(saved) => {
              setMode(undefined)
              onUpdated(saved)
            }}
            onError={setError}
          />
        )}
      </div>
    </>
  )
}

const deliveredSchema = z.object({
  receivedBy: z
    .string()
    .trim()
    .min(2, 'Enter the name of the person who took the parcel.')
    .max(100, 'At most 100 characters.'),
  cashCollected: z.boolean(),
  note: z.string().trim().max(500, 'At most 500 characters.'),
})
type DeliveredValues = z.infer<typeof deliveredSchema>

function DeliveredForm({
  job,
  send,
  onCancel,
  onDone,
  onError,
}: {
  job: DeliveryJob
  send: (u: JobUpdate) => Promise<DeliveryJob>
  onCancel: () => void
  onDone: () => void
  onError: (message: string) => void
}) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DeliveredValues>({
    resolver: zodResolver(deliveredSchema),
    defaultValues: { receivedBy: '', cashCollected: false, note: '' },
  })

  async function onSubmit(v: DeliveredValues) {
    if (job.cashToCollect && !v.cashCollected) {
      setError('cashCollected', {
        message: `Collect ${formatMoney(job.cashToCollect)} first. If the customer cannot pay, choose “Could not deliver”.`,
      })
      return
    }
    try {
      await send({
        action: 'DELIVERED',
        receivedBy: v.receivedBy,
        cashCollected: v.cashCollected,
        note: v.note || null,
      })
      onDone()
    } catch (e) {
      onError(userMessage(e))
    }
  }

  return (
    <Card className="p-4">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <h2 className="font-semibold text-slate-900">Delivered</h2>
        <Input
          label="Received by"
          hint="The name of the person who took the parcel."
          autoComplete="off"
          error={errors.receivedBy?.message}
          {...register('receivedBy')}
        />
        {job.cashToCollect && (
          <div>
            <Checkbox
              label={`I collected ${formatMoney(job.cashToCollect)} in cash`}
              {...register('cashCollected')}
            />
            {errors.cashCollected?.message && (
              <p role="alert" className="mt-1 text-sm text-red-700">
                {errors.cashCollected.message}
              </p>
            )}
          </div>
        )}
        <Input
          label="Note (optional)"
          error={errors.note?.message}
          {...register('note')}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Button type="submit" isLoading={isSubmitting}>
            Confirm delivery
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Back
          </Button>
        </div>
      </form>
    </Card>
  )
}

const failedSchema = z
  .object({
    failureReason: z.string().min(1, 'Choose what happened.'),
    note: z.string().trim().max(500, 'At most 500 characters.'),
  })
  .refine((v) => v.failureReason !== 'OTHER' || v.note.length > 0, {
    path: ['note'],
    message: 'Describe what happened.',
  })
type FailedValues = z.infer<typeof failedSchema>

function FailedForm({
  send,
  onCancel,
  onDone,
  onError,
}: {
  send: (u: JobUpdate) => Promise<DeliveryJob>
  onCancel: () => void
  onDone: (saved: DeliveryJob) => void
  onError: (message: string) => void
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FailedValues>({
    resolver: zodResolver(failedSchema),
    defaultValues: { failureReason: '', note: '' },
  })

  async function onSubmit(v: FailedValues) {
    try {
      onDone(
        await send({
          action: 'FAILED',
          failureReason: v.failureReason as FailureReason,
          note: v.note || null,
        }),
      )
    } catch (e) {
      onError(userMessage(e))
    }
  }

  return (
    <Card className="p-4">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <h2 className="font-semibold text-slate-900">Could not deliver</h2>
        <Select
          label="What happened?"
          error={errors.failureReason?.message}
          {...register('failureReason')}
        >
          <option value="">Choose…</option>
          {FAILURE_REASONS.map((r) => (
            <option key={r} value={r}>
              {FAILURE_REASON_LABELS[r]}
            </option>
          ))}
        </Select>
        <Input
          label="Note"
          hint="Optional, except for “Other reason”. The customer does not see it."
          error={errors.note?.message}
          {...register('note')}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Button type="submit" isLoading={isSubmitting}>
            Save attempt
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Back
          </Button>
        </div>
      </form>
    </Card>
  )
}
