import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router'
import { Button } from '../../components/ui/Button'
import { Checkbox } from '../../components/ui/Checkbox'
import { ErrorState } from '../../components/ui/ErrorState'
import { Input } from '../../components/ui/Input'
import { Textarea } from '../../components/ui/Textarea'
import {
  createCategory,
  getCategory,
  updateCategory,
  type CategoryInput,
} from '../../features/admin/adminCategoryApi'
import {
  categorySchema,
  type CategoryFormValues,
} from '../../features/admin/categorySchema'
import { useAsync } from '../../hooks/useAsync'
import { ApiError, NotFoundError, userMessage } from '../../lib/errors'
import { slugify } from '../../lib/slugify'

const EMPTY: CategoryFormValues = {
  name: '',
  slug: '',
  description: '',
  sortOrder: 0,
  active: true,
}

/** /admin/categories/new and /admin/categories/:id/edit */
export function AdminCategoryFormPage() {
  const { id } = useParams()
  if (!id) return <CategoryForm initial={EMPTY} />
  return <EditCategory id={id} />
}

function EditCategory({ id }: { id: string }) {
  const { state, retry } = useAsync((signal) => getCategory(id, signal), id)
  if (state.status === 'loading')
    return <p className="text-slate-600">Loading category…</p>
  if (state.status === 'error') {
    return state.error instanceof NotFoundError ? (
      <p role="alert" className="text-slate-700">
        This category no longer exists.
      </p>
    ) : (
      <ErrorState description={userMessage(state.error)} onRetry={retry} />
    )
  }
  const c = state.data
  return (
    <CategoryForm
      categoryId={c.id}
      initial={{
        name: c.name,
        slug: c.slug,
        description: c.description ?? '',
        sortOrder: c.sortOrder,
        active: c.active,
      }}
    />
  )
}

function CategoryForm({
  categoryId,
  initial,
}: {
  categoryId?: string
  initial: CategoryFormValues
}) {
  const navigate = useNavigate()
  const isNew = categoryId === undefined
  // For a new category, the slug follows the name until the admin edits it.
  const [slugEdited, setSlugEdited] = useState(!isNew)
  const [formError, setFormError] = useState<string>()

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting, isSubmitted },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: initial,
  })

  async function onSubmit(values: CategoryFormValues) {
    setFormError(undefined)
    const input: CategoryInput = {
      ...values,
      name: values.name.trim(),
      description: values.description.trim() || null,
    }
    try {
      if (isNew) await createCategory(input)
      else await updateCategory(categoryId, input)
      navigate('/admin/categories')
    } catch (error) {
      showServerError(error)
    }
  }

  /** Puts the server's answer next to the field it is about, when possible. */
  function showServerError(error: unknown) {
    if (error instanceof ApiError && error.status === 409) {
      setError('slug', { message: error.message }) // e.g. "slug already exists"
      return
    }
    if (error instanceof ApiError && error.fieldErrors.length > 0) {
      for (const fieldError of error.fieldErrors) {
        if (fieldError.field in EMPTY) {
          setError(fieldError.field as keyof CategoryFormValues, {
            message: fieldError.message,
          })
        }
      }
      return
    }
    setFormError(userMessage(error))
  }

  const title = isNew ? 'New category' : `Edit "${initial.name}"`

  return (
    <>
      <title>{`${title} | Admin`}</title>
      <Link
        to="/admin/categories"
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> All categories
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-slate-900">{title}</h1>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="mt-6 max-w-xl space-y-5 rounded-xl border border-slate-200 bg-white p-6"
      >
        {formError && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800"
          >
            {formError}
          </p>
        )}
        <Input
          label="Name"
          error={errors.name?.message}
          {...register('name', {
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
              if (!slugEdited) {
                setValue('slug', slugify(event.target.value), {
                  shouldValidate: isSubmitted,
                })
              }
            },
          })}
        />
        <Input
          label="Slug"
          hint="Used in web addresses, e.g. /products?category=home-kitchen"
          error={errors.slug?.message}
          {...register('slug', { onChange: () => setSlugEdited(true) })}
        />
        <Textarea
          label="Description (optional)"
          error={errors.description?.message}
          {...register('description')}
        />
        <Input
          label="Sort order"
          type="number"
          min={0}
          hint="Lower numbers are shown first."
          error={errors.sortOrder?.message}
          {...register('sortOrder', { valueAsNumber: true })}
        />
        <Checkbox
          label="Visible in the store"
          hint="Hidden categories (and their products) are not shown to customers."
          {...register('active')}
        />
        <div className="flex gap-3 pt-2">
          <Button type="submit" isLoading={isSubmitting}>
            {isNew ? 'Create category' : 'Save changes'}
          </Button>
          <Link
            to="/admin/categories"
            className="inline-flex items-center px-3 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Cancel
          </Link>
        </div>
      </form>
    </>
  )
}
