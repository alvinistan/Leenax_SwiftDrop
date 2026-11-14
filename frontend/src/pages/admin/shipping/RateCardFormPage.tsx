import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { Checkbox } from '../../../components/ui/Checkbox'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { Select } from '../../../components/ui/Select'
import { applyFieldErrors } from '../../../features/shipping/applyFieldErrors'
import {
  createRateCard,
  getRateCard,
  listProviders,
  updateRateCard,
  type CourierProvider,
} from '../../../features/shipping/shippingApi'
import {
  rateCardSchema,
  type RateCardFormValues,
} from '../../../features/shipping/shippingSchemas'
import { useCountries } from '../../../features/shipping/useCountries'
import { useAsync } from '../../../hooks/useAsync'
import { userMessage } from '../../../lib/errors'

const EMPTY: RateCardFormValues = {
  serviceId: '',
  countryCode: 'LK',
  enabled: true,
  bands: [{ maxWeightKg: '', price: '' }],
}

/** /admin/shipping/rate-cards/new and /admin/shipping/rate-cards/:id/edit */
export function RateCardFormPage() {
  const { id } = useParams()
  const providers = useAsync((signal) => listProviders(signal), 'rc-providers')
  const card = useAsync(
    (signal) => (id ? getRateCard(id, signal) : Promise.resolve(null)),
    `rc-${id ?? 'new'}`,
  )
  const { state: countryState, countries } = useCountries()

  const states = [providers.state, card.state, countryState]
  const failed = states.find((s) => s.status === 'error')

  return (
    <>
      <title>
        {id ? 'Edit rate card' : 'New rate card'} | Shipping | Admin
      </title>
      <Link
        to="/admin/shipping/rate-cards"
        className="inline-flex items-center gap-1 text-sm font-medium text-brand-800 hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Rate cards
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">
        {id ? 'Edit rate card' : 'New rate card'}
      </h1>
      {failed?.status === 'error' && (
        <div className="mt-6">
          <ErrorState description={userMessage(failed.error)} />
        </div>
      )}
      {!failed && states.some((s) => s.status === 'loading') && (
        <p className="mt-6 text-slate-600">Loading…</p>
      )}
      {providers.state.status === 'success' &&
        card.state.status === 'success' &&
        countryState.status === 'success' && (
          <RateCardForm
            id={id}
            providers={providers.state.data}
            countries={countries}
            initial={
              card.state.data
                ? {
                    serviceId: card.state.data.serviceId,
                    countryCode: card.state.data.countryCode,
                    enabled: card.state.data.enabled,
                    bands: card.state.data.bands,
                  }
                : EMPTY
            }
          />
        )}
    </>
  )
}

type FormProps = {
  id?: string
  providers: CourierProvider[]
  countries: { code: string; name: string }[]
  initial: RateCardFormValues
}

function RateCardForm({ id, providers, countries, initial }: FormProps) {
  const navigate = useNavigate()
  const [error, setErrorMessage] = useState<string>()
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RateCardFormValues>({
    resolver: zodResolver(rateCardSchema),
    defaultValues: initial,
  })
  const bands = useFieldArray({ control, name: 'bands' })

  async function onSubmit(values: RateCardFormValues) {
    setErrorMessage(undefined)
    try {
      if (id) await updateRateCard(id, values)
      else await createRateCard(values)
      navigate('/admin/shipping/rate-cards')
    } catch (e) {
      if (!applyFieldErrors(e, setError)) setErrorMessage(userMessage(e))
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6">
      <Card className="p-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Select
            label="Courier service"
            error={errors.serviceId?.message}
            {...register('serviceId')}
          >
            <option value="">Choose…</option>
            {providers.map((provider) => (
              <optgroup key={provider.id} label={provider.name}>
                {provider.services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
          <Select
            label="Destination country"
            error={errors.countryCode?.message}
            {...register('countryCode')}
          >
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </Select>
          <div className="sm:col-span-2">
            <Checkbox
              label="Use this rate card for quotes"
              {...register('enabled')}
            />
          </div>
        </div>
      </Card>

      <Card className="mt-6 p-5">
        <fieldset>
          <legend className="text-lg font-semibold text-slate-900">
            Weight bands (LKR)
          </legend>
          <p className="mt-1 text-sm text-slate-600">
            Each row means &quot;a parcel up to this weight costs this
            much&quot;. Rows must go up in weight. The chargeable weight (after
            the courier&apos;s rounding) picks the first row that covers it.
          </p>
          {errors.bands?.root?.message && (
            <p role="alert" className="mt-2 text-sm font-medium text-red-700">
              {errors.bands.root.message}
            </p>
          )}
          {errors.bands?.message && (
            <p role="alert" className="mt-2 text-sm font-medium text-red-700">
              {errors.bands.message}
            </p>
          )}
          <ol className="mt-4 flex flex-col gap-3">
            {bands.fields.map((field, index) => (
              <li
                key={field.id}
                className="grid items-start gap-3 sm:grid-cols-[1fr_1fr_auto]"
              >
                <Input
                  label={`Band ${index + 1}: up to (kg)`}
                  inputMode="decimal"
                  error={errors.bands?.[index]?.maxWeightKg?.message}
                  {...register(`bands.${index}.maxWeightKg`)}
                />
                <Input
                  label={`Band ${index + 1}: price (LKR)`}
                  inputMode="decimal"
                  error={errors.bands?.[index]?.price?.message}
                  {...register(`bands.${index}.price`)}
                />
                <Button
                  variant="ghost"
                  className="sm:mt-7"
                  onClick={() => bands.remove(index)}
                  disabled={bands.fields.length === 1}
                  aria-label={`Remove band ${index + 1}`}
                >
                  <Trash2 className="size-4 text-red-700" aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ol>
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => bands.append({ maxWeightKg: '', price: '' })}
          >
            <Plus className="size-4" aria-hidden="true" /> Add band
          </Button>
        </fieldset>
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
          Save rate card
        </Button>
        <Link
          to="/admin/shipping/rate-cards"
          className="inline-flex h-11 items-center rounded-lg px-5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          Cancel
        </Link>
      </div>
    </form>
  )
}
