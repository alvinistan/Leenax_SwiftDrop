import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ExternalLink, Pencil } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Link, useParams } from 'react-router'
import { buttonClasses } from '../../../components/ui/buttonStyles'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { Select } from '../../../components/ui/Select'
import { applyFieldErrors } from '../../../features/shipping/applyFieldErrors'
import {
  formatDateTime,
  fromLocalInput,
} from '../../../features/shipping/dates'
import {
  addExpense,
  addTrackingUpdate,
  EXPENSE_KIND_LABELS,
  type ExpenseKind,
  getShipment,
  TRACKING_STATUS_LABELS,
  TRACKING_STATUSES,
  type ShipmentDetail,
  type TrackingStatus,
} from '../../../features/shipping/shippingApi'
import {
  trackingUpdateSchema,
  type TrackingUpdateFormValues,
} from '../../../features/shipping/shippingSchemas'
import {
  StatusMessage,
  type Message,
} from '../../../features/shipping/StatusMessage'
import { TrackingStatusBadge } from '../../../features/shipping/TrackingStatusBadge'
import { useCountries } from '../../../features/shipping/useCountries'
import { useAsync } from '../../../hooks/useAsync'
import { formatMoney } from '../../../lib/money'
import { userMessage } from '../../../lib/errors'

/** /admin/shipping/shipments/:id: details, tracking timeline, new update. */
export function ShipmentDetailPage() {
  const { id = '' } = useParams()
  const { state, retry } = useAsync(
    (signal) => getShipment(id, signal),
    `shipment-${id}`,
  )
  // After an update the server returns the whole shipment again.
  const [updated, setUpdated] = useState<ShipmentDetail>()
  const shipment =
    updated?.id === id
      ? updated
      : state.status === 'success'
        ? state.data
        : undefined

  return (
    <>
      <title>
        {shipment ? `Shipment ${shipment.awb}` : 'Shipment'} | Shipping | Admin
      </title>
      <Link
        to="/admin/shipping/shipments"
        className="inline-flex items-center gap-1 text-sm font-medium text-brand-800 hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Shipments
      </Link>
      {state.status === 'loading' && (
        <p className="mt-6 text-slate-600">Loading shipment…</p>
      )}
      {state.status === 'error' && (
        <div className="mt-6">
          <ErrorState description={userMessage(state.error)} onRetry={retry} />
        </div>
      )}
      {shipment && <Shipment shipment={shipment} onUpdated={setUpdated} />}
    </>
  )
}

function Shipment({
  shipment,
  onUpdated,
}: {
  shipment: ShipmentDetail
  onUpdated: (s: ShipmentDetail) => void
}) {
  const { nameOf } = useCountries()
  const newestFirst = [...shipment.events].reverse()
  return (
    <>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex flex-wrap items-center gap-3 text-2xl font-bold text-slate-900">
          Order {shipment.orderReference}
          <TrackingStatusBadge status={shipment.status} />
        </h1>
        <Link
          to={`/admin/shipping/shipments/${shipment.id}/edit`}
          className={buttonClasses({ variant: 'secondary' })}
        >
          <Pencil className="size-4" aria-hidden="true" /> Edit details
        </Link>
      </div>

      <Card className="mt-6 p-5">
        <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          <Row label="Courier">
            {shipment.providerName}
            {shipment.serviceName && ` · ${shipment.serviceName}`}
          </Row>
          <Row label="Tracking number (AWB)">
            <span className="font-mono">{shipment.awb}</span>
            {shipment.trackingUrl && (
              <a
                href={shipment.trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 flex w-fit items-center gap-1 font-semibold text-brand-800 hover:underline"
              >
                Track on {shipment.providerName}&apos;s website
                <ExternalLink className="size-3.5" aria-hidden="true" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            )}
          </Row>
          <Row label="Destination">
            {[shipment.destinationCity, nameOf(shipment.destinationCountry)]
              .filter(Boolean)
              .join(', ')}
          </Row>
          <Row label="Weight">
            {shipment.weightKg ? `${shipment.weightKg} kg` : '—'}
          </Row>
          <Row label="Courier charge (base)">
            {shipment.courierCost ? formatMoney(shipment.courierCost) : '—'}
          </Row>
          <Row label="Order">
            {shipment.orderNumber ? (
              <Link
                to={`/admin/orders/${shipment.orderNumber}`}
                className="font-semibold text-brand-800 hover:underline"
              >
                {shipment.orderNumber}
              </Link>
            ) : (
              `${shipment.orderReference} (not a website order)`
            )}
            {shipment.deliveryCharged &&
              ` · customer paid ${formatMoney(shipment.deliveryCharged)} for delivery`}
          </Row>
          <Row label="Booked">
            {shipment.bookingMethod === 'MANUAL'
              ? 'By hand on the courier’s portal'
              : 'Through the courier API'}
            , recorded by {shipment.createdBy}
          </Row>
        </dl>
      </Card>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <section aria-labelledby="timeline-heading">
          <h2
            id="timeline-heading"
            className="text-lg font-semibold text-slate-900"
          >
            Tracking history
          </h2>
          <ol className="mt-4 space-y-4 border-l-2 border-slate-200 pl-5">
            {newestFirst.map((event) => (
              <li key={event.id} className="relative">
                <span
                  aria-hidden="true"
                  className="absolute top-1.5 -left-[1.6rem] size-3 rounded-full border-2 border-white bg-brand-700"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <TrackingStatusBadge status={event.status} />
                  <time
                    dateTime={event.occurredAt}
                    className="text-sm text-slate-600"
                  >
                    {formatDateTime(event.occurredAt)}
                  </time>
                </div>
                {(event.location || event.note) && (
                  <p className="mt-1 text-sm text-slate-800">
                    {[event.location, event.note].filter(Boolean).join(' · ')}
                  </p>
                )}
                <p className="text-xs text-slate-500">
                  Entered by {event.recordedBy}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <TrackingUpdateForm shipment={shipment} onUpdated={onUpdated} />
      </div>

      <Expenses shipment={shipment} onUpdated={onUpdated} />
    </>
  )
}

function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <dt className="font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-900">{children}</dd>
    </div>
  )
}

function TrackingUpdateForm({
  shipment,
  onUpdated,
}: {
  shipment: ShipmentDetail
  onUpdated: (s: ShipmentDetail) => void
}) {
  const [message, setMessage] = useState<Message>()
  const allowed = TRACKING_STATUSES.filter((s) =>
    shipment.allowedNextStatuses.includes(s),
  )
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<TrackingUpdateFormValues>({
    resolver: zodResolver(trackingUpdateSchema),
    defaultValues: { status: '', occurredAt: '', location: '', note: '' },
  })

  if (!shipment.manualTracking) {
    return (
      <p className="text-sm text-slate-600">
        Tracking for this courier is updated automatically.
      </p>
    )
  }
  if (allowed.length === 0) {
    return (
      <section aria-labelledby="update-heading">
        <h2
          id="update-heading"
          className="text-lg font-semibold text-slate-900"
        >
          Add a tracking update
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          This shipment is{' '}
          {TRACKING_STATUS_LABELS[shipment.status].toLowerCase()}: no more
          updates can be added.
        </p>
      </section>
    )
  }

  async function onSubmit(v: TrackingUpdateFormValues) {
    setMessage(undefined)
    try {
      const saved = await addTrackingUpdate(shipment.id, {
        status: v.status as TrackingStatus,
        occurredAt: fromLocalInput(v.occurredAt),
        location: v.location || null,
        note: v.note || null,
      })
      reset()
      onUpdated(saved)
      setMessage({
        tone: 'success',
        text: `Status changed to ${TRACKING_STATUS_LABELS[saved.status].toLowerCase()}.`,
      })
    } catch (e) {
      if (!applyFieldErrors(e, setError)) {
        setMessage({ tone: 'error', text: userMessage(e) })
      }
    }
  }

  return (
    <section aria-labelledby="update-heading">
      <h2 id="update-heading" className="text-lg font-semibold text-slate-900">
        Add a tracking update
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Copy the latest status from {shipment.providerName}&apos;s tracking
        page. Updates must be in time order.
      </p>
      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="mt-4 space-y-4"
      >
        <Select
          label="New status"
          error={errors.status?.message}
          {...register('status')}
        >
          <option value="">Choose…</option>
          {allowed.map((s) => (
            <option key={s} value={s}>
              {TRACKING_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
        <Input
          type="datetime-local"
          label="When (optional)"
          hint="Empty = now."
          error={errors.occurredAt?.message}
          {...register('occurredAt')}
        />
        <Input
          label="Location (optional)"
          error={errors.location?.message}
          {...register('location')}
        />
        <Input
          label="Note (optional)"
          error={errors.note?.message}
          {...register('note')}
        />
        <StatusMessage message={message} />
        <Button type="submit" isLoading={isSubmitting}>
          Add update
        </Button>
      </form>
    </section>
  )
}

const expenseSchema = z.object({
  kind: z.enum(['SURCHARGE', 'RETURN', 'ADJUSTMENT']),
  amount: z
    .string()
    .trim()
    .regex(
      /^-?\d{1,13}(\.\d{1,2})?$/,
      'Enter an amount like 150 or -50 (adjustments only).',
    ),
  reference: z.string().trim().max(60, 'At most 60 characters.'),
  incurredOn: z.string(),
  note: z.string().trim().max(300, 'At most 300 characters.'),
})
type ExpenseValues = z.infer<typeof expenseSchema>

/** Extra courier charges after booking. Never edited: correct with an adjustment. */
function Expenses({
  shipment,
  onUpdated,
}: {
  shipment: ShipmentDetail
  onUpdated: (s: ShipmentDetail) => void
}) {
  const [message, setMessage] = useState<Message>()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      kind: 'SURCHARGE',
      amount: '',
      reference: '',
      incurredOn: '',
      note: '',
    },
  })

  async function onSubmit(v: ExpenseValues) {
    setMessage(undefined)
    try {
      onUpdated(
        await addExpense(shipment.id, {
          kind: v.kind,
          amount: v.amount,
          reference: v.reference || null,
          incurredOn: v.incurredOn || null,
          note: v.note || null,
        }),
      )
      reset()
      setMessage({ tone: 'success', text: 'Charge added.' })
    } catch (e) {
      if (!applyFieldErrors(e, setError))
        setMessage({ tone: 'error', text: userMessage(e) })
    }
  }

  return (
    <section aria-labelledby="expenses-heading" className="mt-10">
      <h2
        id="expenses-heading"
        className="text-lg font-semibold text-slate-900"
      >
        Courier charges
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        The base charge plus extra charges from the courier&apos;s invoice
        (surcharges, return fees). Total:{' '}
        <strong>{formatMoney(shipment.totalCourierCost)}</strong>
      </p>
      {shipment.expenses.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-sm">
          {shipment.expenses.map((e) => (
            <li key={e.id} className="flex flex-wrap justify-between gap-2 p-3">
              <span>
                {EXPENSE_KIND_LABELS[e.kind]}
                {e.reference && ` · ${e.reference}`}
                {e.note && ` · ${e.note}`}
                <span className="text-slate-500">
                  {' '}
                  · {e.incurredOn} · {e.recordedBy}
                </span>
              </span>
              <span className="font-semibold">{formatMoney(e.amount)}</span>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-4">
        <fieldset className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
          <legend className="px-1 font-semibold text-slate-900">
            Add a charge
          </legend>
          <Select
            label="Kind"
            error={errors.kind?.message}
            {...register('kind')}
          >
            {(Object.keys(EXPENSE_KIND_LABELS) as ExpenseKind[]).map((k) => (
              <option key={k} value={k}>
                {EXPENSE_KIND_LABELS[k]}
              </option>
            ))}
          </Select>
          <Input
            label="Amount (LKR)"
            inputMode="decimal"
            error={errors.amount?.message}
            {...register('amount')}
          />
          <Input
            type="date"
            label="Invoice date (optional)"
            hint="Empty = today."
            error={errors.incurredOn?.message}
            {...register('incurredOn')}
          />
          <Input
            label="Invoice number (optional)"
            error={errors.reference?.message}
            {...register('reference')}
          />
          <div className="sm:col-span-2">
            <Input
              label="Note (optional)"
              error={errors.note?.message}
              {...register('note')}
            />
          </div>
          <div className="sm:col-span-3">
            <StatusMessage message={message} className="mb-3" />
            <Button type="submit" variant="secondary" isLoading={isSubmitting}>
              Add charge
            </Button>
          </div>
        </fieldset>
      </form>
    </section>
  )
}
