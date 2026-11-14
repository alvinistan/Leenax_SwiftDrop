import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { Select } from '../../../components/ui/Select'
import { Textarea } from '../../../components/ui/Textarea'
import { applyFieldErrors } from '../../../features/shipping/applyFieldErrors'
import { fromLocalInput } from '../../../features/shipping/dates'
import {
  createShipment,
  getShipment,
  listProviders,
  updateShipment,
  type CourierProvider,
  type ShipmentDetail,
} from '../../../features/shipping/shippingApi'
import {
  shipmentSchema,
  type ShipmentFormValues,
} from '../../../features/shipping/shippingSchemas'
import { useCountries } from '../../../features/shipping/useCountries'
import {
  adminGetOrder,
  type AdminOrder,
} from '../../../features/orders/ordersApi'
import { useAsync } from '../../../hooks/useAsync'
import { userMessage } from '../../../lib/errors'

/** /admin/shipping/shipments/new and /admin/shipping/shipments/:id/edit */
export function ShipmentFormPage() {
  const { id } = useParams()
  // ?order=SD-001001: recording the parcel of a website order (details come from the order).
  const [params] = useSearchParams()
  const orderNumber = id ? null : params.get('order')
  const beforePayment =
    orderNumber !== null && params.get('beforePayment') === '1'
  const order = useAsync(
    (signal) =>
      orderNumber ? adminGetOrder(orderNumber, signal) : Promise.resolve(null),
    `sf-order-${orderNumber ?? ''}`,
  )
  const providers = useAsync((signal) => listProviders(signal), 'sf-providers')
  const shipment = useAsync(
    (signal) => (id ? getShipment(id, signal) : Promise.resolve(null)),
    `sf-${id ?? 'new'}`,
  )
  const { state: countryState, countries } = useCountries()
  const states = [providers.state, shipment.state, countryState, order.state]
  const failed = states.find((s) => s.status === 'error')
  const back = id
    ? `/admin/shipping/shipments/${id}`
    : '/admin/shipping/shipments'

  return (
    <>
      <title>
        {id ? 'Edit shipment' : 'Record shipment'} | Shipping | Admin
      </title>
      <Link
        to={back}
        className="inline-flex items-center gap-1 text-sm font-medium text-brand-800 hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />{' '}
        {id ? 'Shipment' : 'Shipments'}
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">
        {id ? 'Edit shipment details' : 'Record a shipment'}
      </h1>
      {!id && (
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Book the parcel with the courier first (DEX: on their portal or at
          their office). Then enter the tracking number (AWB) they gave you.
          SwiftDrop does not contact the courier.
        </p>
      )}
      {failed?.status === 'error' && (
        <div className="mt-6">
          <ErrorState description={userMessage(failed.error)} />
        </div>
      )}
      {!failed && states.some((s) => s.status === 'loading') && (
        <p className="mt-6 text-slate-600">Loading…</p>
      )}
      {providers.state.status === 'success' &&
        shipment.state.status === 'success' &&
        countryState.status === 'success' &&
        order.state.status === 'success' && (
          <ShipmentForm
            beforePayment={beforePayment}
            order={order.state.data}
            shipment={shipment.state.data}
            providers={providers.state.data}
            countries={countries}
          />
        )}
    </>
  )
}

type FormProps = {
  beforePayment: boolean
  order: AdminOrder | null
  shipment: ShipmentDetail | null
  providers: CourierProvider[]
  countries: { code: string; name: string }[]
}

function ShipmentForm({
  beforePayment,
  order,
  shipment,
  providers,
  countries,
}: FormProps) {
  const navigate = useNavigate()
  const [error, setErrorMessage] = useState<string>()
  // Only couriers that are on and can be booked by hand (capabilities, not names).
  const bookable = providers.filter(
    (p) => p.enabled && p.capabilities.includes('MANUAL_BOOKING'),
  )
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ShipmentFormValues>({
    resolver: zodResolver(shipmentSchema),
    defaultValues: shipment
      ? {
          providerId: shipment.providerId,
          serviceId: shipment.serviceId ?? '',
          orderReference: shipment.orderReference,
          awb: shipment.awb,
          destinationCountry: shipment.destinationCountry,
          destinationCity: shipment.destinationCity ?? '',
          weightKg: shipment.weightKg ?? '',
          courierCost: shipment.courierCost?.amount ?? '',
          bookedAt: '',
          shipBeforePaymentReason: '',
        }
      : order
        ? {
            // From the order: the courier and service the customer chose, and where it goes.
            providerId:
              bookable.find((p) => p.code === order.shipping.providerCode)
                ?.id ?? '',
            serviceId: '',
            orderReference: order.orderNumber,
            awb: '',
            destinationCountry: order.address.countryCode,
            destinationCity: order.address.city,
            weightKg: order.shipping.chargeableWeightKg,
            courierCost: '',
            bookedAt: '',
            shipBeforePaymentReason: '',
          }
        : {
            providerId: bookable.length === 1 ? bookable[0].id : '',
            serviceId: '',
            orderReference: '',
            awb: '',
            destinationCountry: 'LK',
            destinationCity: '',
            weightKg: '',
            courierCost: '',
            bookedAt: '',
            shipBeforePaymentReason: '',
          },
  })
  const providerId = useWatch({ control, name: 'providerId' })
  const services =
    providers
      .find((p) => p.id === providerId)
      ?.services.filter((s) => s.enabled) ?? []

  async function onSubmit(v: ShipmentFormValues) {
    setErrorMessage(undefined)
    if (beforePayment && v.shipBeforePaymentReason.length < 5) {
      setError('shipBeforePaymentReason', {
        message:
          'Write why this order ships before payment (at least 5 characters).',
      })
      return
    }
    const details = {
      serviceId: v.serviceId || null,
      orderReference: v.orderReference,
      awb: v.awb,
      destinationCountry: v.destinationCountry,
      destinationCity: v.destinationCity || null,
      weightKg: v.weightKg || null,
      courierCost: v.courierCost || null,
    }
    try {
      const saved = shipment
        ? await updateShipment(shipment.id, details)
        : await createShipment({
            providerId: v.providerId,
            orderNumber: order?.orderNumber ?? null,
            shipBeforePaymentReason: beforePayment
              ? v.shipBeforePaymentReason
              : null,
            bookedAt: fromLocalInput(v.bookedAt),
            details,
          })
      navigate(`/admin/shipping/shipments/${saved.id}`)
    } catch (e) {
      // Server field paths look like "details.awb"; the form uses "awb".
      if (
        !applyFieldErrors(e, setError, (field) =>
          field.replace(/^details\./, ''),
        )
      ) {
        setErrorMessage(userMessage(e))
      }
    }
  }

  if (!shipment && bookable.length === 0) {
    return (
      <p className="mt-6 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
        No courier is turned on. Turn one on in{' '}
        <Link
          to="/admin/shipping/providers"
          className="font-semibold underline"
        >
          Couriers
        </Link>{' '}
        first.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6">
      <Card className="p-5">
        <div className="grid gap-5 sm:grid-cols-2">
          {shipment ? (
            <p className="text-sm sm:col-span-2">
              <span className="font-medium text-slate-800">Courier:</span>{' '}
              {shipment.providerName}
            </p>
          ) : (
            <Select
              label="Courier"
              error={errors.providerId?.message}
              {...register('providerId')}
            >
              <option value="">Choose…</option>
              {bookable.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          )}
          <Select
            label="Service (optional)"
            error={errors.serviceId?.message}
            {...register('serviceId')}
          >
            <option value="">Not specified</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Input
            label="Tracking number (AWB)"
            autoComplete="off"
            className="font-mono uppercase"
            error={errors.awb?.message}
            {...register('awb')}
          />
          <Input
            label="Order reference"
            hint={
              order || shipment?.orderNumber
                ? 'The website order this parcel belongs to.'
                : 'Your own order number, e.g. from WhatsApp or the phone order book.'
            }
            readOnly={Boolean(order || shipment?.orderNumber)}
            error={errors.orderReference?.message}
            {...register('orderReference')}
          />
          <Select
            label="Destination country"
            error={errors.destinationCountry?.message}
            {...register('destinationCountry')}
          >
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </Select>
          <Input
            label="Destination city (optional)"
            hint="City only. The customer's name and address stay with the courier."
            error={errors.destinationCity?.message}
            {...register('destinationCity')}
          />
          <Input
            label="Parcel weight (kg, optional)"
            inputMode="decimal"
            error={errors.weightKg?.message}
            {...register('weightKg')}
          />
          <Input
            label="Courier charge (LKR, optional)"
            hint="What the courier charged you, from their receipt."
            inputMode="decimal"
            error={errors.courierCost?.message}
            {...register('courierCost')}
          />
          {beforePayment && (
            <div className="sm:col-span-2">
              <Textarea
                label="Why ship before payment?"
                hint="Kept in the order history for you; the customer does not see it."
                rows={2}
                error={errors.shipBeforePaymentReason?.message}
                {...register('shipBeforePaymentReason')}
              />
            </div>
          )}
          {!shipment && (
            <Input
              type="datetime-local"
              label="Booked at (optional)"
              hint="Empty = now."
              error={errors.bookedAt?.message}
              {...register('bookedAt')}
            />
          )}
        </div>
      </Card>
      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800"
        >
          {error}
        </p>
      )}
      <div className="mt-6 flex gap-2">
        <Button type="submit" isLoading={isSubmitting}>
          {shipment ? 'Save details' : 'Record shipment'}
        </Button>
        <Link
          to={
            shipment
              ? `/admin/shipping/shipments/${shipment.id}`
              : '/admin/shipping/shipments'
          }
          className="inline-flex h-11 items-center rounded-lg px-5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          Cancel
        </Link>
      </div>
    </form>
  )
}
