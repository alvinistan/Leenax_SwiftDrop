import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '../../components/ui/Button'
import { buttonClasses } from '../../components/ui/buttonStyles'
import { Card } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { ErrorState } from '../../components/ui/ErrorState'
import { Input } from '../../components/ui/Input'
import { applyFieldErrors } from '../../features/shipping/applyFieldErrors'
import {
  StatusMessage,
  type Message,
} from '../../features/shipping/StatusMessage'
import {
  createTaxRate,
  deleteTaxRate,
  listTaxRates,
  updateTaxRate,
  type TaxRate,
} from '../../features/tax/taxApi'
import { useAsync } from '../../hooks/useAsync'
import { toScaled } from '../../lib/decimal'
import { userMessage } from '../../lib/errors'

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required.')
    .max(60, 'At most 60 characters.'),
  percent: z
    .string()
    .trim()
    .regex(/^\d{1,3}(\.\d{1,2})?$/, 'Enter a percent like 18 or 2.5.')
    .refine(
      (v) => !/^\d{1,3}(\.\d{1,2})?$/.test(v) || toScaled(v, 2) <= 10000n,
      'At most 100.',
    ),
})
type Values = z.infer<typeof schema>

/** Tax rates INCLUDED in prices, chosen per product (owner decision D-9). */
export function AdminTaxRatesPage() {
  const { state, retry } = useAsync(
    (signal) => listTaxRates(signal),
    'tax-rates',
  )
  const [editing, setEditing] = useState<TaxRate | 'new' | null>(null)
  const [toDelete, setToDelete] = useState<TaxRate | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [message, setMessage] = useState<Message>()

  async function confirmDelete() {
    if (!toDelete) return
    setIsDeleting(true)
    try {
      await deleteTaxRate(toDelete.id)
      setMessage({ tone: 'success', text: `"${toDelete.name}" was deleted.` })
      retry()
    } catch (error) {
      setMessage({ tone: 'error', text: userMessage(error) })
    } finally {
      setIsDeleting(false)
      setToDelete(null)
    }
  }

  return (
    <>
      <title>Tax rates | Admin</title>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tax rates</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Product prices already include tax. Choose a rate for each product
            in the product form; orders then show how much tax they include.
            Changing a rate affects new orders only. Ask your accountant which
            rates apply.
          </p>
        </div>
        {editing === null && (
          <Button
            onClick={() => {
              setMessage(undefined)
              setEditing('new')
            }}
          >
            <Plus className="size-4" aria-hidden="true" /> New tax rate
          </Button>
        )}
      </div>
      <StatusMessage message={message} className="mt-4" />
      {editing !== null && (
        <TaxRateForm
          rate={editing === 'new' ? null : editing}
          onDone={(text) => {
            setEditing(null)
            if (text) {
              setMessage({ tone: 'success', text })
              retry()
            }
          }}
        />
      )}
      <div className="mt-6">
        {state.status === 'loading' && (
          <p className="text-slate-600">Loading tax rates…</p>
        )}
        {state.status === 'error' && (
          <ErrorState description={userMessage(state.error)} onRetry={retry} />
        )}
        {state.status === 'success' && state.data.length === 0 && (
          <p className="text-sm text-slate-500">
            No tax rates yet: prices are shown without a tax line.
          </p>
        )}
        {state.status === 'success' && state.data.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Name
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Percent
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Products
                  </th>
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.data.map((rate) => (
                  <tr key={rate.id}>
                    <th
                      scope="row"
                      className="px-4 py-3 font-medium text-slate-900"
                    >
                      {rate.name}
                    </th>
                    <td className="px-4 py-3">{rate.percent}%</td>
                    <td className="px-4 py-3">{rate.productCount}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          className={buttonClasses({
                            variant: 'ghost',
                            size: 'sm',
                          })}
                          aria-label={`Edit ${rate.name}`}
                          onClick={() => {
                            setMessage(undefined)
                            setEditing(rate)
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
                          aria-label={`Delete ${rate.name}`}
                          onClick={() => {
                            setMessage(undefined)
                            setToDelete(rate)
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
        title={`Delete "${toDelete?.name ?? ''}"?`}
        message="Rates used by products cannot be deleted. Orders already placed keep their tax."
        confirmLabel="Delete tax rate"
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
        isWorking={isDeleting}
      />
    </>
  )
}

function TaxRateForm({
  rate,
  onDone,
}: {
  rate: TaxRate | null
  onDone: (text?: string) => void
}) {
  const [error, setErrorMessage] = useState<string>()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: rate
      ? { name: rate.name, percent: rate.percent }
      : { name: '', percent: '' },
  })

  async function onSubmit(values: Values) {
    setErrorMessage(undefined)
    try {
      if (rate) await updateTaxRate(rate.id, values)
      else await createTaxRate(values)
      onDone(`Tax rate "${values.name}" saved.`)
    } catch (e) {
      if (!applyFieldErrors(e, setError)) setErrorMessage(userMessage(e))
    }
  }

  return (
    <Card className="mt-4 p-5">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 font-semibold text-slate-900">
            {rate ? `Edit "${rate.name}"` : 'New tax rate'}
          </legend>
          <Input
            label="Name"
            hint='e.g. "VAT 18%"'
            error={errors.name?.message}
            {...register('name')}
          />
          <Input
            label="Percent (%)"
            inputMode="decimal"
            error={errors.percent?.message}
            {...register('percent')}
          />
        </fieldset>
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
            Save tax rate
          </Button>
          <Button variant="secondary" onClick={() => onDone()}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  )
}
