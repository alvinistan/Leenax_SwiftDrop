import { zodResolver } from '@hookform/resolvers/zod'
import { ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { Checkbox } from '../../../components/ui/Checkbox'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { Select } from '../../../components/ui/Select'
import { Textarea } from '../../../components/ui/Textarea'
import { applyFieldErrors } from '../../../features/shipping/applyFieldErrors'
import {
  listProviders,
  updateProvider,
  type CourierProvider,
  type ProviderCapability,
} from '../../../features/shipping/shippingApi'
import {
  StatusMessage,
  type Message,
} from '../../../features/shipping/StatusMessage'
import { useAsync } from '../../../hooks/useAsync'
import { userMessage } from '../../../lib/errors'

const providerSchema = z.object({
  enabled: z.boolean(),
  ratesSource: z.enum(['API', 'RATE_CARD']),
  volumetricDivisor: z.union([
    z.literal(''),
    z
      .string()
      .trim()
      .regex(/^[1-9]\d{0,6}$/, 'Enter a whole number, e.g. 5000.'),
  ]),
  weightRoundingIncrementKg: z
    .string()
    .trim()
    .regex(/^\d{1,3}(\.\d{1,3})?$/, 'Enter kilograms, e.g. 0.5 or 1.')
    .refine((v) => !/^0*(\.0*)?$/.test(v), 'Must be more than 0.'),
  rulesVerified: z.boolean(),
  notes: z.string().max(500, 'At most 500 characters.'),
  services: z.array(z.object({ id: z.string(), enabled: z.boolean() })),
  trackingUrlTemplate: z.union([
    z.literal(''),
    z
      .string()
      .trim()
      .max(300, 'At most 300 characters.')
      .regex(
        /^https:\/\/\S*\{awb\}\S*$/,
        'Use a secure link (https://) that contains {awb}, e.g. https://courier.example/track?awb={awb}.',
      ),
  ]),
})
type ProviderFormValues = z.infer<typeof providerSchema>

const CAPABILITY_LABELS: Record<ProviderCapability, string> = {
  RATE_CARD: 'Prices from our rate card',
  LIVE_RATES: 'Live prices (API)',
  MANUAL_BOOKING: 'Book on courier portal, record AWB here',
  MANUAL_TRACKING: 'Tracking updates entered by hand',
  TRACKING_LINK: 'Link to courier tracking page',
}

/**
 * Couriers: on/off, where prices come from, and the weight rules. Courier API
 * keys are never entered or shown here: they will live only on the server
 * (environment variables or a secrets manager) when an API is connected.
 */
export function CourierProvidersPage() {
  const { state, retry } = useAsync(
    (signal) => listProviders(signal),
    'shipping-providers',
  )

  return (
    <>
      <title>Couriers | Shipping | Admin</title>
      <h1 className="text-2xl font-bold text-slate-900">Couriers</h1>
      <p className="mt-1 max-w-3xl text-sm text-slate-600">
        Turn couriers on or off and set how they charge. Rules marked &quot;not
        verified&quot; are placeholders: confirm the volumetric divisor and
        weight rounding with each courier before relying on the prices.
      </p>
      <p className="mt-3 flex max-w-3xl items-start gap-2 rounded-lg bg-slate-100 p-3 text-sm text-slate-700">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        Courier API keys are never stored or shown in this screen. When an API
        is connected (DHL in Shipping Phase D), its keys are kept on the server
        only.
      </p>
      <div className="mt-6 flex flex-col gap-6">
        {state.status === 'loading' && (
          <p className="text-slate-600">Loading couriers…</p>
        )}
        {state.status === 'error' && (
          <ErrorState description={userMessage(state.error)} onRetry={retry} />
        )}
        {state.status === 'success' &&
          state.data.map((provider) => (
            <ProviderCard key={provider.id} provider={provider} />
          ))}
      </div>
    </>
  )
}

function toForm(p: CourierProvider): ProviderFormValues {
  return {
    enabled: p.enabled,
    ratesSource: p.ratesSource,
    volumetricDivisor: p.volumetricDivisor?.toString() ?? '',
    weightRoundingIncrementKg: p.weightRoundingIncrementKg,
    rulesVerified: p.rulesVerified,
    notes: p.notes ?? '',
    services: p.services.map((s) => ({ id: s.id, enabled: s.enabled })),
    trackingUrlTemplate: p.trackingUrlTemplate ?? '',
  }
}

function ProviderCard({ provider }: { provider: CourierProvider }) {
  const [current, setCurrent] = useState(provider)
  const [message, setMessage] = useState<Message>()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    control,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProviderFormValues>({
    resolver: zodResolver(providerSchema),
    defaultValues: toForm(provider),
  })
  const source = useWatch({ control, name: 'ratesSource' })

  async function onSubmit(values: ProviderFormValues) {
    setMessage(undefined)
    try {
      const saved = await updateProvider(current.id, {
        ...values,
        volumetricDivisor:
          values.volumetricDivisor === ''
            ? null
            : Number(values.volumetricDivisor),
        notes: values.notes.trim() || null,
        trackingUrlTemplate: values.trackingUrlTemplate || null,
      })
      setCurrent(saved)
      reset(toForm(saved))
      setMessage({ tone: 'success', text: `${saved.name} saved.` })
    } catch (error) {
      if (!applyFieldErrors(error, setError)) {
        setMessage({ tone: 'error', text: userMessage(error) })
      }
    }
  }

  return (
    <Card className="p-5">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-2 text-lg font-semibold text-slate-900">
            {current.name}
          </h2>
          {current.enabled ? (
            <Badge tone="success">On</Badge>
          ) : (
            <Badge>Off</Badge>
          )}
          {current.ratesSource === 'API' && (
            <Badge tone="warning">Live rates not connected yet</Badge>
          )}
          {!current.rulesVerified && (
            <Badge tone="warning">Rules not verified</Badge>
          )}
        </div>

        <div className="mt-3">
          <p className="text-sm font-medium text-slate-700">
            What SwiftDrop can do with {current.name}
          </p>
          <ul
            className="mt-1 flex flex-wrap gap-2"
            aria-label={`${current.name} capabilities`}
          >
            {current.capabilities.map((capability) => (
              <li key={capability}>
                <Badge tone="brand">{CAPABILITY_LABELS[capability]}</Badge>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Checkbox
              label={`Use ${current.name} for quotes`}
              {...register('enabled')}
            />
          </div>
          <Select
            label="Where prices come from"
            hint={
              source === 'API'
                ? 'Live prices from the courier. Needs API access (not connected yet).'
                : 'Prices you type in from the courier’s price list (Rate cards).'
            }
            error={errors.ratesSource?.message}
            {...register('ratesSource')}
          >
            <option value="RATE_CARD">Our rate card</option>
            <option value="API">Courier API (live)</option>
          </Select>
          <Input
            label="Volumetric divisor (optional)"
            hint="Size-based weight = L × W × H (cm) ÷ divisor. Leave empty if this courier charges by actual weight only."
            inputMode="numeric"
            error={errors.volumetricDivisor?.message}
            {...register('volumetricDivisor')}
          />
          <Input
            label="Round weight up to steps of (kg)"
            hint="e.g. 0.5 means 1.2 kg is charged as 1.5 kg."
            inputMode="decimal"
            error={errors.weightRoundingIncrementKg?.message}
            {...register('weightRoundingIncrementKg')}
          />
          <div className="self-end">
            <Checkbox
              label="I have confirmed these rules with the courier"
              {...register('rulesVerified')}
            />
          </div>
          <div className="sm:col-span-2">
            <Input
              label="Tracking link format (optional)"
              hint="Copy it from the courier's official website and put {awb} where the tracking number goes. Shipments then get a “track on the courier's website” link."
              placeholder="https://…{awb}…"
              error={errors.trackingUrlTemplate?.message}
              {...register('trackingUrlTemplate')}
            />
          </div>
          <div className="sm:col-span-2">
            <Textarea
              label="Notes (optional)"
              rows={2}
              error={errors.notes?.message}
              {...register('notes')}
            />
          </div>
        </div>

        <fieldset className="mt-5">
          <legend className="text-sm font-semibold text-slate-800">
            Services
          </legend>
          <ul className="mt-2 flex flex-col gap-2">
            {current.services.map((service, index) => (
              <li key={service.id}>
                <input type="hidden" {...register(`services.${index}.id`)} />
                <Checkbox
                  label={service.name}
                  hint={
                    service.scope === 'DOMESTIC'
                      ? 'Within Sri Lanka'
                      : 'International'
                  }
                  {...register(`services.${index}.enabled`)}
                />
              </li>
            ))}
          </ul>
        </fieldset>

        <StatusMessage message={message} className="mt-4" />
        <div className="mt-5">
          <Button type="submit" isLoading={isSubmitting} disabled={!isDirty}>
            Save {current.name}
          </Button>
        </div>
      </form>
    </Card>
  )
}
