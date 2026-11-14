import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { Checkbox } from '../../../components/ui/Checkbox'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { Select } from '../../../components/ui/Select'
import { applyFieldErrors } from '../../../features/shipping/applyFieldErrors'
import { fromLocalInput, toLocalInput } from '../../../features/shipping/dates'
import {
  createMarkupRule,
  listMarkupRules,
  listProviders,
  updateMarkupRule,
  type CourierProvider,
  type MarkupRule,
} from '../../../features/shipping/shippingApi'
import {
  markupSchema,
  type MarkupFormInput,
  type MarkupFormValues,
} from '../../../features/shipping/shippingSchemas'
import { useCountries } from '../../../features/shipping/useCountries'
import { useAsync } from '../../../hooks/useAsync'
import { NotFoundError, userMessage } from '../../../lib/errors'

const EMPTY: MarkupFormInput = {
  name: '',
  type: 'PERCENT',
  percent: '',
  fixedAmount: '',
  minFee: '',
  maxFee: '',
  providerId: '',
  countryCode: '',
  effectiveFrom: '',
  effectiveTo: '',
  enabled: true,
  priority: '0',
}

function toForm(rule: MarkupRule): MarkupFormInput {
  return {
    name: rule.name,
    type: rule.type,
    percent: rule.percent ?? '',
    fixedAmount: rule.fixedAmount ?? '',
    minFee: rule.minFee ?? '',
    maxFee: rule.maxFee ?? '',
    providerId: rule.providerId ?? '',
    countryCode: rule.countryCode ?? '',
    effectiveFrom: toLocalInput(rule.effectiveFrom),
    effectiveTo: toLocalInput(rule.effectiveTo),
    enabled: rule.enabled,
    priority: String(rule.priority),
  }
}

/** /admin/shipping/markup/new and /admin/shipping/markup/:id/edit */
export function MarkupRuleFormPage() {
  const { id } = useParams()
  const providers = useAsync((signal) => listProviders(signal), 'mf-providers')
  const rule = useAsync(
    async (signal) => {
      if (!id) return null
      const found = (await listMarkupRules(signal)).find((r) => r.id === id)
      if (!found)
        throw new NotFoundError('This platform fee rule was not found.')
      return found
    },
    `mf-${id ?? 'new'}`,
  )
  const { state: countryState, countries } = useCountries()
  const states = [providers.state, rule.state, countryState]
  const failed = states.find((s) => s.status === 'error')

  return (
    <>
      <title>
        {id ? 'Edit platform fee rule' : 'New platform fee rule'} | Shipping |
        Admin
      </title>
      <Link
        to="/admin/shipping/markup"
        className="inline-flex items-center gap-1 text-sm font-medium text-brand-800 hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Platform fee
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">
        {id ? 'Edit platform fee rule' : 'New platform fee rule'}
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
        rule.state.status === 'success' &&
        countryState.status === 'success' && (
          <MarkupForm
            id={id}
            providers={providers.state.data}
            countries={countries}
            initial={rule.state.data ? toForm(rule.state.data) : EMPTY}
          />
        )}
    </>
  )
}

type FormProps = {
  id?: string
  providers: CourierProvider[]
  countries: { code: string; name: string }[]
  initial: MarkupFormInput
}

function MarkupForm({ id, providers, countries, initial }: FormProps) {
  const navigate = useNavigate()
  const [error, setErrorMessage] = useState<string>()
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<MarkupFormInput, unknown, MarkupFormValues>({
    resolver: zodResolver(markupSchema),
    defaultValues: initial,
  })
  const type = useWatch({ control, name: 'type' })

  async function onSubmit(v: MarkupFormValues) {
    setErrorMessage(undefined)
    const input = {
      name: v.name,
      type: v.type,
      percent: v.type === 'FIXED' ? null : v.percent || null,
      fixedAmount: v.type === 'PERCENT' ? null : v.fixedAmount || null,
      minFee: v.minFee || null,
      maxFee: v.maxFee || null,
      providerId: v.providerId || null,
      countryCode: v.countryCode || null,
      effectiveFrom: fromLocalInput(v.effectiveFrom),
      effectiveTo: fromLocalInput(v.effectiveTo),
      enabled: v.enabled,
      priority: v.priority,
    }
    try {
      if (id) await updateMarkupRule(id, input)
      else await createMarkupRule(input)
      navigate('/admin/shipping/markup')
    } catch (e) {
      if (!applyFieldErrors(e, setError)) setErrorMessage(userMessage(e))
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6">
      <Card className="p-5">
        <fieldset className="grid gap-5 sm:grid-cols-2">
          <legend className="mb-4 text-lg font-semibold text-slate-900">
            Fee
          </legend>
          <Input
            label="Name"
            error={errors.name?.message}
            {...register('name')}
          />
          <Select
            label="Fee type"
            error={errors.type?.message}
            {...register('type')}
          >
            <option value="PERCENT">Percent of the courier price</option>
            <option value="FIXED">Fixed amount (LKR)</option>
            <option value="COMBINED">Percent + fixed amount</option>
          </Select>
          {type !== 'FIXED' && (
            <Input
              label="Percent (%)"
              inputMode="decimal"
              error={errors.percent?.message}
              {...register('percent')}
            />
          )}
          {type !== 'PERCENT' && (
            <Input
              label="Fixed amount (LKR)"
              inputMode="decimal"
              error={errors.fixedAmount?.message}
              {...register('fixedAmount')}
            />
          )}
          <Input
            label="Minimum fee (LKR, optional)"
            inputMode="decimal"
            error={errors.minFee?.message}
            {...register('minFee')}
          />
          <Input
            label="Maximum fee (LKR, optional)"
            inputMode="decimal"
            error={errors.maxFee?.message}
            {...register('maxFee')}
          />
        </fieldset>
      </Card>

      <Card className="mt-6 p-5">
        <fieldset className="grid gap-5 sm:grid-cols-2">
          <legend className="mb-4 text-lg font-semibold text-slate-900">
            When it applies
          </legend>
          <Select
            label="Courier"
            error={errors.providerId?.message}
            {...register('providerId')}
          >
            <option value="">All couriers</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Select
            label="Destination country"
            error={errors.countryCode?.message}
            {...register('countryCode')}
          >
            <option value="">All countries</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </Select>
          <Input
            type="datetime-local"
            label="Starts (optional)"
            hint="Empty = from now."
            error={errors.effectiveFrom?.message}
            {...register('effectiveFrom')}
          />
          <Input
            type="datetime-local"
            label="Ends (optional)"
            hint="Empty = no end date."
            error={errors.effectiveTo?.message}
            {...register('effectiveTo')}
          />
          <Input
            label="Priority"
            hint="Only matters when two equally specific rules match: the higher number wins."
            inputMode="numeric"
            error={errors.priority?.message}
            {...register('priority')}
          />
          <div className="self-center">
            <Checkbox label="Rule is on" {...register('enabled')} />
          </div>
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
          Save rule
        </Button>
        <Link
          to="/admin/shipping/markup"
          className="inline-flex h-11 items-center rounded-lg px-5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          Cancel
        </Link>
      </div>
    </form>
  )
}
