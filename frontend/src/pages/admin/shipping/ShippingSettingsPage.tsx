import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { buttonClasses } from '../../../components/ui/buttonStyles'
import { Card } from '../../../components/ui/Card'
import { Checkbox } from '../../../components/ui/Checkbox'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { Select } from '../../../components/ui/Select'
import { applyFieldErrors } from '../../../features/shipping/applyFieldErrors'
import {
  createPreset,
  deletePreset,
  getSettings,
  listPresets,
  updatePreset,
  updateSettings,
  type BoxPreset,
  type ShippingSettings,
} from '../../../features/shipping/shippingApi'
import {
  boxSchema,
  settingsSchema,
  type BoxFormValues,
  type SettingsFormValues,
} from '../../../features/shipping/shippingSchemas'
import {
  StatusMessage,
  type Message,
} from '../../../features/shipping/StatusMessage'
import { useAsync } from '../../../hooks/useAsync'
import { userMessage } from '../../../lib/errors'

/** Pickup address, who pays import duties, default packaging and box sizes. */
export function ShippingSettingsPage() {
  const settings = useAsync(
    (signal) => getSettings(signal),
    'shipping-settings',
  )

  return (
    <>
      <title>Pickup and boxes | Shipping | Admin</title>
      <h1 className="text-2xl font-bold text-slate-900">Pickup and boxes</h1>
      <p className="mt-1 max-w-3xl text-sm text-slate-600">
        Where couriers collect parcels, and the boxes you pack them in. Box
        sizes are used to work out the parcel size for couriers that charge by
        volume.
      </p>
      <div className="mt-6 flex flex-col gap-8">
        {settings.state.status === 'loading' && (
          <p className="text-slate-600">Loading settings…</p>
        )}
        {settings.state.status === 'error' && (
          <ErrorState
            description={userMessage(settings.state.error)}
            onRetry={settings.retry}
          />
        )}
        {settings.state.status === 'success' && (
          <SettingsForm initial={settings.state.data} />
        )}
        <BoxPresets />
      </div>
    </>
  )
}

function toForm(s: ShippingSettings): SettingsFormValues {
  return {
    originLine1: s.originLine1,
    originLine2: s.originLine2 ?? '',
    originCity: s.originCity,
    originPostalCode: s.originPostalCode ?? '',
    originCountry: s.originCountry,
    defaultPackagingKg: s.defaultPackagingKg,
    dutiesPaidBy: s.dutiesPaidBy,
  }
}

function SettingsForm({ initial }: { initial: ShippingSettings }) {
  const [message, setMessage] = useState<Message>()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: toForm(initial),
  })

  async function onSubmit(values: SettingsFormValues) {
    setMessage(undefined)
    try {
      const saved = await updateSettings({
        ...values,
        originLine2: values.originLine2 || null,
        originPostalCode: values.originPostalCode || null,
      })
      reset(toForm(saved))
      setMessage({ tone: 'success', text: 'Pickup settings saved.' })
    } catch (error) {
      if (!applyFieldErrors(error, setError)) {
        setMessage({ tone: 'error', text: userMessage(error) })
      }
    }
  }

  return (
    <Card className="p-5">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <fieldset className="grid gap-5 sm:grid-cols-2">
          <legend className="mb-4 text-lg font-semibold text-slate-900">
            Pickup address
          </legend>
          <Input
            label="Address line 1"
            autoComplete="address-line1"
            error={errors.originLine1?.message}
            {...register('originLine1')}
          />
          <Input
            label="Address line 2 (optional)"
            autoComplete="address-line2"
            error={errors.originLine2?.message}
            {...register('originLine2')}
          />
          <Input
            label="City"
            autoComplete="address-level2"
            error={errors.originCity?.message}
            {...register('originCity')}
          />
          <Input
            label="Postal code (optional)"
            autoComplete="postal-code"
            error={errors.originPostalCode?.message}
            {...register('originPostalCode')}
          />
          <Input
            label="Country"
            hint="Two-letter code. Deliveries inside this country are domestic."
            maxLength={2}
            error={errors.originCountry?.message}
            {...register('originCountry')}
          />
        </fieldset>

        <fieldset className="mt-8 grid gap-5 sm:grid-cols-2">
          <legend className="mb-4 text-lg font-semibold text-slate-900">
            Defaults
          </legend>
          <Input
            label="Default packaging weight (kg)"
            hint="Used when no box size is set up."
            inputMode="decimal"
            error={errors.defaultPackagingKg?.message}
            {...register('defaultPackagingKg')}
          />
          <Select
            label="Import duties and taxes abroad"
            hint="Shown to customers ordering from abroad."
            error={errors.dutiesPaidBy?.message}
            {...register('dutiesPaidBy')}
          >
            <option value="RECEIVER">Paid by the receiver</option>
            <option value="SENDER">Paid by us (the sender)</option>
          </Select>
        </fieldset>

        <StatusMessage message={message} className="mt-5" />
        <div className="mt-6">
          <Button type="submit" isLoading={isSubmitting} disabled={!isDirty}>
            Save settings
          </Button>
        </div>
      </form>
    </Card>
  )
}

const EMPTY_BOX: BoxFormValues = {
  name: '',
  lengthCm: '',
  widthCm: '',
  heightCm: '',
  emptyWeightKg: '',
  maxWeightKg: '',
  enabled: true,
}

function BoxPresets() {
  const { state, retry } = useAsync(
    (signal) => listPresets(signal),
    'shipping-presets',
  )
  /** null = no form open; 'new' = adding; a box = editing it. */
  const [editing, setEditing] = useState<BoxPreset | 'new' | null>(null)
  const [toDelete, setToDelete] = useState<BoxPreset | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [message, setMessage] = useState<Message>()

  async function confirmDelete() {
    if (!toDelete) return
    setIsDeleting(true)
    try {
      await deletePreset(toDelete.id)
      setMessage({ tone: 'success', text: `Box "${toDelete.name}" deleted.` })
      retry()
    } catch (error) {
      setMessage({ tone: 'error', text: userMessage(error) })
    } finally {
      setIsDeleting(false)
      setToDelete(null)
    }
  }

  return (
    <section aria-labelledby="boxes-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            id="boxes-heading"
            className="text-lg font-semibold text-slate-900"
          >
            Box sizes
          </h2>
          <p className="text-sm text-slate-600">
            The smallest box that fits the order is used. Boxes marked
            &quot;(example)&quot; are placeholders: replace them with your real
            boxes.
          </p>
        </div>
        {editing === null && (
          <Button
            variant="secondary"
            onClick={() => {
              setMessage(undefined)
              setEditing('new')
            }}
          >
            <Plus className="size-4" aria-hidden="true" /> Add box
          </Button>
        )}
      </div>

      <StatusMessage message={message} className="mt-4" />

      {editing !== null && (
        <BoxForm
          box={editing === 'new' ? null : editing}
          onDone={(text) => {
            setEditing(null)
            if (text) {
              setMessage({ tone: 'success', text })
              retry()
            }
          }}
        />
      )}

      <div className="mt-4">
        {state.status === 'loading' && (
          <p className="text-slate-600">Loading boxes…</p>
        )}
        {state.status === 'error' && (
          <ErrorState description={userMessage(state.error)} onRetry={retry} />
        )}
        {state.status === 'success' && state.data.length === 0 && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            No boxes yet. Without box sizes, couriers that charge by volume
            cannot be priced automatically.
          </p>
        )}
        {state.status === 'success' && state.data.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Box
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Size (cm)
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Empty weight
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Max weight
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.data.map((box) => (
                  <tr key={box.id}>
                    <th
                      scope="row"
                      className="px-4 py-3 font-medium text-slate-900"
                    >
                      {box.name}
                    </th>
                    <td className="px-4 py-3 text-slate-600">
                      {box.lengthCm} × {box.widthCm} × {box.heightCm}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {box.emptyWeightKg} kg
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {box.maxWeightKg ? `${box.maxWeightKg} kg` : 'No limit'}
                    </td>
                    <td className="px-4 py-3">
                      {box.enabled ? (
                        <Badge tone="success">In use</Badge>
                      ) : (
                        <Badge>Not used</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          className={buttonClasses({
                            variant: 'ghost',
                            size: 'sm',
                          })}
                          aria-label={`Edit box ${box.name}`}
                          onClick={() => {
                            setMessage(undefined)
                            setEditing(box)
                          }}
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className={buttonClasses({
                            variant: 'ghost',
                            size: 'sm',
                          })}
                          aria-label={`Delete box ${box.name}`}
                          onClick={() => {
                            setMessage(undefined)
                            setToDelete(box)
                          }}
                        >
                          <Trash2
                            className="size-4 text-red-700"
                            aria-hidden="true"
                          />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={toDelete !== null}
        title={`Delete box "${toDelete?.name ?? ''}"?`}
        message="Quotes already given keep their box. New quotes will not use this box."
        confirmLabel="Delete box"
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
        isWorking={isDeleting}
      />
    </section>
  )
}

function BoxForm({
  box,
  onDone,
}: {
  box: BoxPreset | null
  onDone: (successText?: string) => void
}) {
  const [error, setErrorMessage] = useState<string>()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<BoxFormValues>({
    resolver: zodResolver(boxSchema),
    defaultValues: box
      ? { ...box, maxWeightKg: box.maxWeightKg ?? '' }
      : EMPTY_BOX,
  })

  async function onSubmit(values: BoxFormValues) {
    setErrorMessage(undefined)
    const input = { ...values, maxWeightKg: values.maxWeightKg || null }
    try {
      if (box) {
        await updatePreset(box.id, input)
        onDone(`Box "${values.name}" saved.`)
      } else {
        await createPreset(input)
        onDone(`Box "${values.name}" added.`)
      }
    } catch (e) {
      if (!applyFieldErrors(e, setError)) setErrorMessage(userMessage(e))
    }
  }

  return (
    <Card className="mt-4 p-5">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <fieldset className="grid gap-4 sm:grid-cols-3">
          <legend className="mb-3 font-semibold text-slate-900">
            {box ? `Edit box "${box.name}"` : 'New box'}
          </legend>
          <Input
            label="Name"
            error={errors.name?.message}
            {...register('name')}
          />
          <Input
            label="Length (cm)"
            inputMode="decimal"
            error={errors.lengthCm?.message}
            {...register('lengthCm')}
          />
          <Input
            label="Width (cm)"
            inputMode="decimal"
            error={errors.widthCm?.message}
            {...register('widthCm')}
          />
          <Input
            label="Height (cm)"
            inputMode="decimal"
            error={errors.heightCm?.message}
            {...register('heightCm')}
          />
          <Input
            label="Empty box weight (kg)"
            inputMode="decimal"
            error={errors.emptyWeightKg?.message}
            {...register('emptyWeightKg')}
          />
          <Input
            label="Maximum weight (kg, optional)"
            inputMode="decimal"
            error={errors.maxWeightKg?.message}
            {...register('maxWeightKg')}
          />
        </fieldset>
        <div className="mt-4">
          <Checkbox label="Use this box for quotes" {...register('enabled')} />
        </div>
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800"
          >
            {error}
          </p>
        )}
        <div className="mt-5 flex gap-2">
          <Button type="submit" isLoading={isSubmitting}>
            {box ? 'Save box' : 'Add box'}
          </Button>
          <Button variant="secondary" onClick={() => onDone()}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  )
}
