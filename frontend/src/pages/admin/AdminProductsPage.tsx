import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Pagination } from '../../components/navigation/Pagination'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { buttonClasses } from '../../components/ui/buttonStyles'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import {
  deleteProduct,
  listAdminProducts,
  type AdminProductSummary,
} from '../../features/admin/adminProductApi'
import { useAsync } from '../../hooks/useAsync'
import { userMessage } from '../../lib/errors'
import { formatUnitPrice } from '../../lib/money'
import type { ProductStatus } from '../../types/catalog'

const STATUSES: ProductStatus[] = ['ACTIVE', 'DRAFT', 'ARCHIVED']
const STATUS_TONE = {
  ACTIVE: 'success',
  DRAFT: 'warning',
  ARCHIVED: 'neutral',
} as const

/** /admin/products?q=cake&status=DRAFT&page=2: the filters live in the URL (see Phase 4). */
export function AdminProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const q = searchParams.get('q') ?? ''
  const statusParam = searchParams.get('status')
  const status = STATUSES.find((s) => s === statusParam)
  const page = Math.max(1, Number(searchParams.get('page')) || 1)

  const { state, retry } = useAsync(
    (signal) => listAdminProducts({ q, status, page: page - 1 }, signal),
    `${q}|${status}|${page}`,
  )
  const [toDelete, setToDelete] = useState<AdminProductSummary | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [message, setMessage] = useState<{
    tone: 'success' | 'error'
    text: string
  }>()

  function updateParams(changes: Record<string, string | undefined>) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      for (const [name, value] of Object.entries(changes)) {
        if (value) next.set(name, value)
        else next.delete(name)
      }
      return next
    })
  }

  async function confirmDelete() {
    if (!toDelete) return
    setIsDeleting(true)
    try {
      await deleteProduct(toDelete.id)
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
      <title>Products | Admin</title>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Products</h1>
        <Link to="/admin/products/new" className={buttonClasses()}>
          <Plus className="size-4" aria-hidden="true" /> New product
        </Link>
      </div>

      <form
        role="search"
        className="mt-6 flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          // A new search starts again at page 1.
          updateParams({
            q: String(form.get('q') ?? '').trim(),
            page: undefined,
          })
        }}
      >
        <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-800">
          Search by name
          <input
            name="q"
            type="search"
            defaultValue={q}
            key={q}
            className="h-10 w-64 rounded-lg border border-slate-300 bg-white px-3 font-normal"
          />
        </label>
        <Button type="submit" variant="secondary" size="sm" className="h-10">
          <Search className="size-4" aria-hidden="true" /> Search
        </Button>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-800">
          Status
          <select
            value={status ?? ''}
            onChange={(event) =>
              updateParams({ status: event.target.value, page: undefined })
            }
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 font-normal"
          >
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </label>
      </form>

      {message && (
        <p
          role={message.tone === 'error' ? 'alert' : 'status'}
          className={`mt-4 rounded-lg p-3 text-sm font-medium ${
            message.tone === 'error'
              ? 'bg-red-50 text-red-800'
              : 'bg-brand-50 text-brand-900'
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="mt-6">
        {state.status === 'loading' && (
          <p className="text-slate-600">Loading products…</p>
        )}
        {state.status === 'error' && (
          <ErrorState description={userMessage(state.error)} onRetry={retry} />
        )}
        {state.status === 'success' && state.data.content.length === 0 && (
          <EmptyState
            title={q || status ? 'No products match' : 'No products yet'}
            description={
              q || status
                ? 'Try another search or status.'
                : 'Create your first product.'
            }
          />
        )}
        {state.status === 'success' && state.data.content.length > 0 && (
          <>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Product
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Category
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Variants
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      From
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Stock
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.data.content.map((product) => (
                    <tr key={product.id}>
                      <th
                        scope="row"
                        className="px-4 py-3 font-medium text-slate-900"
                      >
                        {product.name}
                        <span className="block text-xs font-normal text-slate-500">
                          {product.slug}
                        </span>
                      </th>
                      <td className="px-4 py-3 text-slate-600">
                        {product.category.name}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {product.variantCount}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {product.fromPrice && product.fromPriceUnit
                          ? formatUnitPrice(
                              product.fromPrice,
                              product.fromPriceUnit,
                            )
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {product.inStock ? (
                          <Badge tone="success">In stock</Badge>
                        ) : (
                          <Badge tone="danger">Out of stock</Badge>
                        )}
                        {!product.shippingReady && (
                          <Badge tone="warning" className="ml-1">
                            Weight missing
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={STATUS_TONE[product.status]}>
                          {product.status.charAt(0) +
                            product.status.slice(1).toLowerCase()}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Link
                            to={`/admin/products/${product.id}/edit`}
                            className={buttonClasses({
                              variant: 'ghost',
                              size: 'sm',
                            })}
                            aria-label={`Edit ${product.name}`}
                          >
                            <Pencil className="size-4" aria-hidden="true" />
                          </Link>
                          <button
                            type="button"
                            className={buttonClasses({
                              variant: 'ghost',
                              size: 'sm',
                            })}
                            aria-label={`Delete ${product.name}`}
                            onClick={() => {
                              setMessage(undefined)
                              setToDelete(product)
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
            <div className="mt-6">
              <Pagination
                page={page}
                totalPages={state.data.totalPages}
                hrefFor={(target) => {
                  const next = new URLSearchParams(searchParams)
                  if (target === 1) next.delete('page')
                  else next.set('page', String(target))
                  return `?${next.toString()}`
                }}
              />
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={toDelete !== null}
        title={`Delete "${toDelete?.name ?? ''}"?`}
        message="This permanently deletes the product and all its variants. To stop selling it but keep it, set its status to Archived instead."
        confirmLabel="Delete product"
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
        isWorking={isDeleting}
      />
    </>
  )
}
