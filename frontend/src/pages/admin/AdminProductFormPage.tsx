import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Plus, X } from 'lucide-react'
import { useState } from 'react'
import {
  Controller,
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
import { CountryBlockPicker } from '../../features/shipping/CountryBlockPicker'
import { useCountries } from '../../features/shipping/useCountries'
import { listTaxRates } from '../../features/tax/taxApi'
import { useAsync } from '../../hooks/useAsync'
import { ApiError, NotFoundError, userMessage } from '../../lib/errors'
import { ProductImagesSection } from '../../features/admin/ProductImagesSection'
import { slugify } from '../../lib/slugify'
import type { Category } from '../../types/catalog'

const EMPTY: ProductFormValues = {
  categoryId: '',
  name: '',
  slug: '',
  description: '',
  status: 'DRAFT',
  variants: [newVariant()],
  shippingCategory: 'GENERAL',
  hsCode: '',
  countryOfOrigin: 'LK',
  customsDescription: '',
  shippingDomesticOnly: false,
  shippingBlockedCountries: [],
  taxRateId: '',
  codAllowed: false,
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
      shippingWeightKg: v.shippingWeightKg ?? '',
      lengthCm: v.dimensions?.lengthCm ?? '',
      widthCm: v.dimensions?.widthCm ?? '',
      heightCm: v.dimensions?.heightCm ?? '',
      options: Object.entries(v.options).map(([name, value]) => ({
        name,
        value,
      })),
      active: v.active,
    })),
    shippingCategory: product.shippingCategory,
    hsCode: product.hsCode ?? '',
    countryOfOrigin: product.countryOfOrigin,
    customsDescription: product.customsDescription ?? '',
    shippingDomesticOnly: product.shippingDomesticOnly,
    shippingBlockedCountries: product.shippingBlockedCountries,
    taxRateId: product.taxRateId ?? '',
    codAllowed: product.codAllowed,
  }
}

/** The form's values → what the API expects. Empty optional fields become null. */
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
      shippingWeightKg: v.shippingWeightKg || null,
      lengthCm: v.lengthCm || null,
      widthCm: v.widthCm || null,
      heightCm: v.heightCm || null,
      options: Object.fromEntries(
        v.options.map((o) => [o.name.trim(), o.value.trim()]),
      ),
      active: v.active,
    })),
    shippingCategory: values.shippingCategory,
    hsCode: values.hsCode.trim() || null,
    countryOfOrigin: values.countryOfOrigin.trim(),
    customsDescription: values.customsDescription.trim() || null,
    shippingDomesticOnly: values.shippingDomesticOnly,
    shippingBlockedCountries: values.shippingDomesticOnly
      ? []
      : values.shippingBlockedCountries,
    taxRateId: values.taxRateId || null,
    codAllowed: values.codAllowed,
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
    <>
      <ProductForm
        productId={product?.id}
        initial={product ? toFormValues(product) : EMPTY}
        categories={categories}
      />
      <div className="mt-8 max-w-4xl">
        {product ? (
          <ProductImagesSection
            productId={product.id}
            initial={product.images}
          />
        ) : (
          <p className="text-sm text-slate-600">
            You can add photos after creating the product.
          </p>
        )}
      </div>
    </>
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

        <ShippingDetailsSection
          register={register}
          errors={errors}
          control={control}
        />

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

      <div className="mt-5 grid gap-5 sm:grid-cols-4">
        <Input
          label={
            saleUnit === 'KG'
              ? 'Shipping weight per kg sold (kg)'
              : 'Shipping weight per piece (kg)'
          }
          hint="Packed weight, including the box or bag."
          inputMode="decimal"
          error={e?.shippingWeightKg?.message}
          {...register(`variants.${index}.shippingWeightKg`)}
        />
        <Input
          label="Packed length (cm)"
          inputMode="decimal"
          error={e?.lengthCm?.message}
          {...register(`variants.${index}.lengthCm`)}
        />
        <Input
          label="Packed width (cm)"
          inputMode="decimal"
          error={e?.widthCm?.message}
          {...register(`variants.${index}.widthCm`)}
        />
        <Input
          label="Packed height (cm)"
          inputMode="decimal"
          error={e?.heightCm?.message}
          {...register(`variants.${index}.heightCm`)}
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

const CATEGORY_HELP: Record<ProductFormValues['shippingCategory'], string> = {
  GENERAL: 'Ordinary goods (clothes, kitchenware…).',
  FOOD_SHELF_STABLE:
    'Packed food that keeps for weeks (rich cake, sweets, dried fish). Couriers and destination countries restrict food, especially animal products: confirm before shipping.',
  FOOD_PERISHABLE: 'Food that spoils quickly (fresh cakes).',
  FRAGILE: 'Breakable items. Needs careful packing.',
}

type ShippingDetailsProps = {
  register: UseFormRegister<ProductFormValues>
  errors: FieldErrors<ProductFormValues>
  control: Control<ProductFormValues>
}

/** Product-level shipping and customs details (each variant has its own weight and size). */
function ShippingDetailsSection({
  register,
  errors,
  control,
}: ShippingDetailsProps) {
  const category = useWatch({ control, name: 'shippingCategory' })
  return (
    <section
      aria-labelledby="shipping-heading"
      className="space-y-5 rounded-xl border border-slate-200 bg-white p-6"
    >
      <div>
        <h2
          id="shipping-heading"
          className="text-lg font-semibold text-slate-900"
        >
          Shipping and customs
        </h2>
        <p className="text-sm text-slate-600">
          Used to calculate shipping prices and for international parcels.
        </p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Select
          label="Shipping category"
          hint={`${CATEGORY_HELP[category]} Where each category may be sent is set in Shipping → Country restrictions.`}
          error={errors.shippingCategory?.message}
          {...register('shippingCategory')}
        >
          <option value="GENERAL">General goods</option>
          <option value="FOOD_SHELF_STABLE">Shelf-stable food</option>
          <option value="FOOD_PERISHABLE">Perishable food</option>
          <option value="FRAGILE">Fragile</option>
        </Select>
        <Input
          label="Country of origin"
          hint="Two-letter code, e.g. LK for Sri Lanka."
          maxLength={2}
          error={errors.countryOfOrigin?.message}
          {...register('countryOfOrigin')}
        />
        <Input
          label="HS code (optional)"
          hint="Customs code, e.g. 0305.59 for dried fish. Needed before shipping abroad."
          error={errors.hsCode?.message}
          {...register('hsCode')}
        />
        <Input
          label="Customs description (optional)"
          hint='Plain words, e.g. "Dried fish, vacuum packed".'
          error={errors.customsDescription?.message}
          {...register('customsDescription')}
        />
      </div>
      <ProductShippingRestrictions control={control} register={register} />
      <SalesSettings register={register} errors={errors} />
    </section>
  )
}

/**
 * Restrictions for THIS product only, on top of its category's rules: for
 * example dried fish blocked for Australia while rich cake (same category)
 * may still go there.
 */
function ProductShippingRestrictions({
  control,
  register,
}: Pick<ShippingDetailsProps, 'control' | 'register'>) {
  const domesticOnly = useWatch({ control, name: 'shippingDomesticOnly' })
  const name = useWatch({ control, name: 'name' })
  const { state, countries, nameOf } = useCountries()
  return (
    <fieldset className="border-t border-slate-100 pt-5">
      <legend className="font-semibold text-slate-900">
        Where this product may be sent
      </legend>
      <p className="text-sm text-slate-600">
        This product follows its shipping category&apos;s country rules. Add
        restrictions here only if this product is refused where others in the
        category are allowed.
      </p>
      <div className="mt-3">
        <Checkbox
          label="Sri Lanka only (this product)"
          hint="Never offer delivery abroad for this product."
          {...register('shippingDomesticOnly')}
        />
      </div>
      {!domesticOnly && (
        <div className="mt-4">
          <p className="text-sm font-medium text-slate-800">
            Also blocked for this product
          </p>
          {state.status === 'error' ? (
            <p role="alert" className="mt-1 text-sm text-red-700">
              {userMessage(state.error)}
            </p>
          ) : (
            <Controller
              control={control}
              name="shippingBlockedCountries"
              render={({ field }) => (
                <CountryBlockPicker
                  value={field.value}
                  onChange={field.onChange}
                  countries={countries}
                  nameOf={nameOf}
                  subject={name || 'this product'}
                />
              )}
            />
          )}
        </div>
      )}
    </fieldset>
  )
}

/** Tax included in the price, and whether cash on delivery may be offered. */
function SalesSettings({
  register,
  errors,
}: Pick<ShippingDetailsProps, 'register' | 'errors'>) {
  const { state } = useAsync((signal) => listTaxRates(signal), 'form-tax-rates')
  return (
    <fieldset className="grid gap-5 border-t border-slate-100 pt-5 sm:grid-cols-2">
      <legend className="font-semibold text-slate-900">Tax and payment</legend>
      <Select
        label="Tax included in the price"
        hint={
          state.status === 'success' && state.data.length === 0
            ? 'No tax rates yet: add them in Admin → Tax rates.'
            : 'Prices already include this tax.'
        }
        error={errors.taxRateId?.message}
        {...register('taxRateId')}
      >
        <option value="">No tax</option>
        {state.status === 'success' &&
          state.data.map((rate) => (
            <option key={rate.id} value={rate.id}>
              {rate.name} ({rate.percent}%)
            </option>
          ))}
      </Select>
      <div className="self-center">
        <Checkbox
          label="Cash on delivery allowed"
          hint="Offered only for Sri Lanka addresses, and only if every product in the order allows it."
          {...register('codAllowed')}
        />
      </div>
    </fieldset>
  )
}
