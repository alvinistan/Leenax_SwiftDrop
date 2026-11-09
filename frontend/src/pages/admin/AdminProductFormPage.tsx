import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Plus, X } from 'lucide-react'
import { useState } from 'react'
import {
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
} from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router'
import { Button } from '../../components/ui/Button'
import { Checkbox } from '../../components/ui/Checkbox'
import { ErrorState } from '../../components/ui/ErrorState'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Textarea } from '../../components/ui/Textarea'
import { listAllCategories } from '../../features/admin/adminCategoryApi'
import {
  createProduct,
  getAdminProduct,
  updateProduct,
  type AdminProductDetail,
  type ProductInput,
} from '../../features/admin/adminProductApi'
import {
  newVariant,
  productSchema,
  type ProductFormValues,
} from '../../features/admin/productSchema'
import { useAsync } from '../../hooks/useAsync'
import { ApiError, NotFoundError, userMessage } from '../../lib/errors'
import { slugify } from '../../lib/slugify'
import type { Category } from '../../types/catalog'

const EMPTY: ProductFormValues = {
  categoryId: '',
  name: '',
  slug: '',
  description: '',
  status: 'DRAFT',
  variants: [newVariant()],
}

/** The API's product → the form's values (numbers stay exact text). */
function toFormValues(product: AdminProductDetail): ProductFormValues {
  return {
    categoryId: product.category.id,
    name: product.name,
    slug: product.slug,
    description: product.description ?? '',
    status: product.status,
    variants: product.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      price: v.price.amount,
      saleUnit: v.saleUnit,
      minQuantity: v.quantity.min,
      maxQuantity: v.quantity.max ?? '',
      quantityStep: v.quantity.step,
      stockQuantity: v.stockQuantity,
      options: Object.entries(v.options).map(([name, value]) => ({
        name,
        value,
      })),
      active: v.active,
    })),
  }
}

/** The form's values → what the API expects. */
function toInput(values: ProductFormValues): ProductInput {
  return {
    categoryId: values.categoryId,
    name: values.name.trim(),
    slug: values.slug,
    description: values.description.trim() || null,
    status: values.status,
    variants: values.variants.map((v) => ({
      id: v.id,
      sku: v.sku.trim(),
      price: v.price,
      saleUnit: v.saleUnit,
      minQuantity: v.minQuantity,
      maxQuantity: v.maxQuantity || null,
      quantityStep: v.quantityStep,
      stockQuantity: v.stockQuantity,
      options: Object.fromEntries(
        v.options.map((o) => [o.name.trim(), o.value.trim()]),
      ),
      active: v.active,
    })),
  }
}

/** /admin/products/new and /admin/products/:id/edit */
export function AdminProductFormPage() {
  const { id } = useParams()
  const data = useAsync(
    async (signal) => ({
      categories: await listAllCategories(signal),
      product: id ? await getAdminProduct(id, signal) : null,
    }),
    id ?? 'new',
  )

  if (data.state.status === 'loading')
    return <p className="text-slate-600">Loading…</p>
  if (data.state.status === 'error') {
    return data.state.error instanceof NotFoundError ? (
      <p role="alert" className="text-slate-700">
        This product no longer exists.
      </p>
    ) : (
      <ErrorState
        description={userMessage(data.state.error)}
        onRetry={data.retry}
      />
    )
  }
  const { categories, product } = data.state.data
  return (
    <ProductForm
      productId={product?.id}
      initial={product ? toFormValues(product) : EMPTY}
      categories={categories}
    />
  )
}

type ProductFormProps = {
  productId?: string
  initial: ProductFormValues
  categories: Category[]
}

function ProductForm({ productId, initial, categories }: ProductFormProps) {
  const navigate = useNavigate()
  const isNew = productId === undefined
  const [slugEdited, setSlugEdited] = useState(!isNew)
  const [formError, setFormError] = useState<string>()

  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting, isSubmitted },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: initial,
  })

  // useFieldArray: a list of inputs that can grow and shrink (one entry per variant).
  const variants = useFieldArray({ control, name: 'variants' })

  async function onSubmit(values: ProductFormValues) {
    setFormError(undefined)
    try {
      if (isNew) await createProduct(toInput(values))
      else await updateProduct(productId, toInput(values))
      navigate('/admin/products')
    } catch (error) {
      showServerError(error)
    }
  }

  /** Puts the server's answer next to the field it is about, when possible. */
  function showServerError(error: unknown) {
    if (
      error instanceof ApiError &&
      error.status === 409 &&
      error.message.includes('slug')
    ) {
      setError('slug', { message: error.message })
      return
    }
    if (error instanceof ApiError && error.fieldErrors.length > 0) {
      const unplaced: string[] = []
      for (const fieldError of error.fieldErrors) {
        // The server says "variants[0].price"; the form calls it "variants.0.price".
        const path = fieldError.field.replace(/\[(\d+)\]/g, '.$1')
        if (
          /^(categoryId|name|slug|description|status)$|^variants\.\d+\.(sku|price|minQuantity|maxQuantity|quantityStep|stockQuantity)$/.test(
            path,
          )
        ) {
          setError(path as 'name', { message: fieldError.message })
        } else {
          unplaced.push(fieldError.message)
        }
      }
      if (unplaced.length > 0) setFormError(unplaced.join(' '))
      return
    }
    setFormError(userMessage(error)) // e.g. "These SKUs are already used: …"
  }

  const title = isNew ? 'New product' : `Edit "${initial.name}"`

  return (
    <>
      <title>{`${title} | Admin`}</title>
      <Link
        to="/admin/products"
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> All products
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-slate-900">{title}</h1>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="mt-6 max-w-4xl space-y-6"
      >
        {formError && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800"
          >
            {formError}
          </p>
        )}

        <section
          aria-labelledby="details-heading"
          className="space-y-5 rounded-xl border border-slate-200 bg-white p-6"
        >
          <h2
            id="details-heading"
            className="text-lg font-semibold text-slate-900"
          >
            Details
          </h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              label="Name"
              error={errors.name?.message}
              {...register('name', {
                onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                  if (!slugEdited)
                    setValue('slug', slugify(event.target.value), {
                      shouldValidate: isSubmitted,
                    })
                },
              })}
            />
            <Input
              label="Slug"
              hint="Used in the product's web address."
              error={errors.slug?.message}
              {...register('slug', { onChange: () => setSlugEdited(true) })}
            />
            <Select
              label="Category"
              error={errors.categoryId?.message}
              {...register('categoryId')}
            >
              <option value="">Choose a category…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.active ? '' : ' (hidden)'}
                </option>
              ))}
            </Select>
            <Select
              label="Status"
              hint="Only Active products are shown in the store."
              error={errors.status?.message}
              {...register('status')}
            >
              <option value="DRAFT">Draft (hidden)</option>
              <option value="ACTIVE">Active (for sale)</option>
              <option value="ARCHIVED">Archived (no longer sold)</option>
            </Select>
          </div>
          <Textarea
            label="Description (optional)"
            error={errors.description?.message}
            {...register('description')}
          />
        </section>

        <section aria-labelledby="variants-heading" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2
                id="variants-heading"
                className="text-lg font-semibold text-slate-900"
              >
                Variants
              </h2>
              <p className="text-sm text-slate-600">
                Each size, colour or weight option that customers can choose. A
                simple product has one.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => variants.append(newVariant())}
            >
              <Plus className="size-4" aria-hidden="true" /> Add variant
            </Button>
          </div>
          {errors.variants?.root?.message && (
            <p role="alert" className="text-sm font-medium text-red-700">
              {errors.variants.root.message}
            </p>
          )}
          {variants.fields.map((field, index) => (
            // key={field.id}: useFieldArray's own stable id, NOT the array index.
            <VariantFields
              key={field.id}
              index={index}
              control={control}
              register={register}
              setValue={setValue}
              errors={errors}
              onRemove={
                variants.fields.length > 1
                  ? () => variants.remove(index)
                  : undefined
              }
            />
          ))}
        </section>

        <div className="flex gap-3">
          <Button type="submit" isLoading={isSubmitting}>
            {isNew ? 'Create product' : 'Save changes'}
          </Button>
          <Link
            to="/admin/products"
            className="inline-flex items-center px-3 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Cancel
          </Link>
        </div>
      </form>
    </>
  )
}

type VariantFieldsProps = {
  index: number
  control: Control<ProductFormValues>
  register: UseFormRegister<ProductFormValues>
  setValue: UseFormSetValue<ProductFormValues>
  errors: FieldErrors<ProductFormValues>
  /** Undefined when this is the only variant (a product needs at least one). */
  onRemove?: () => void
}

function VariantFields({
  index,
  control,
  register,
  setValue,
  errors,
  onRemove,
}: VariantFieldsProps) {
  // useWatch re-renders only this variant when its sale unit changes.
  const saleUnit = useWatch({ control, name: `variants.${index}.saleUnit` })
  const options = useFieldArray({ control, name: `variants.${index}.options` })
  const e = errors.variants?.[index]
  const unit = saleUnit === 'KG' ? 'kg' : 'pieces'
  const label = `Variant ${index + 1}`

  return (
    // The <legend> must be the fieldset's FIRST child: that is what names the group
    // ("Variant 1") for screen readers. The Remove button is positioned separately.
    <fieldset className="relative rounded-xl border border-slate-200 bg-white p-6">
      <legend className="sr-only">{label}</legend>
      <p aria-hidden="true" className="font-semibold text-slate-900">
        {label}
      </p>
      {onRemove && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
          className="absolute right-4 top-4"
        >
          <X className="size-4" aria-hidden="true" /> Remove
        </Button>
      )}

      <div className="mt-4 grid gap-5 sm:grid-cols-3">
        <Input
          label="SKU"
          hint="Your stock code, e.g. CAKE-1KG"
          error={e?.sku?.message}
          {...register(`variants.${index}.sku`)}
        />
        <Select
          label="Sold"
          {...register(`variants.${index}.saleUnit`, {
            onChange: (event: React.ChangeEvent<HTMLSelectElement>) => {
              // Sensible defaults for the new unit.
              const defaults = newVariant(event.target.value as 'PIECE' | 'KG')
              setValue(`variants.${index}.minQuantity`, defaults.minQuantity)
              setValue(`variants.${index}.quantityStep`, defaults.quantityStep)
            },
          })}
        >
          <option value="PIECE">By the piece</option>
          <option value="KG">By weight (kg)</option>
        </Select>
        <Input
          label={
            saleUnit === 'KG' ? 'Price per kg (LKR)' : 'Price per piece (LKR)'
          }
          inputMode="decimal"
          error={e?.price?.message}
          {...register(`variants.${index}.price`)}
        />
        <Input
          label={`Minimum order (${unit})`}
          inputMode="decimal"
          error={e?.minQuantity?.message}
          {...register(`variants.${index}.minQuantity`)}
        />
        <Input
          label={`Maximum order (${unit})`}
          hint="Leave empty for no limit."
          inputMode="decimal"
          error={e?.maxQuantity?.message}
          {...register(`variants.${index}.maxQuantity`)}
        />
        <Input
          label={`Step (${unit})`}
          hint={saleUnit === 'KG' ? 'e.g. 0.5 = half-kilo steps' : 'Usually 1'}
          inputMode="decimal"
          error={e?.quantityStep?.message}
          {...register(`variants.${index}.quantityStep`)}
        />
        <Input
          label={`Stock (${unit})`}
          inputMode="decimal"
          error={e?.stockQuantity?.message}
          {...register(`variants.${index}.stockQuantity`)}
        />
      </div>

      <div className="mt-5">
        <p className="text-sm font-medium text-slate-800">
          Options (e.g. Size: 1 kg)
        </p>
        <div className="mt-2 space-y-3">
          {options.fields.map((option, optionIndex) => (
            <div key={option.id} className="flex items-start gap-3">
              <Input
                label={`Option ${optionIndex + 1} name`}
                placeholder="Size"
                error={e?.options?.[optionIndex]?.name?.message}
                {...register(`variants.${index}.options.${optionIndex}.name`)}
              />
              <Input
                label={`Option ${optionIndex + 1} value`}
                placeholder="1 kg"
                error={e?.options?.[optionIndex]?.value?.message}
                {...register(`variants.${index}.options.${optionIndex}.value`)}
              />
              <Button
                variant="ghost"
                size="sm"
                className="mt-7"
                onClick={() => options.remove(optionIndex)}
                aria-label={`Remove option ${optionIndex + 1} of ${label}`}
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>
        {options.fields.length < 5 && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => options.append({ name: '', value: '' })}
          >
            <Plus className="size-4" aria-hidden="true" /> Add option
          </Button>
        )}
      </div>

      <div className="mt-5">
        <Checkbox
          label="Available"
          hint="Unticked variants are hidden from customers."
          {...register(`variants.${index}.active`)}
        />
      </div>
    </fieldset>
  )
}
