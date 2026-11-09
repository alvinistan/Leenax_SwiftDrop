import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Badge } from '../../components/ui/Badge'
import { buttonClasses } from '../../components/ui/buttonStyles'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import {
  deleteCategory,
  listAllCategories,
} from '../../features/admin/adminCategoryApi'
import { useAsync } from '../../hooks/useAsync'
import { userMessage } from '../../lib/errors'
import type { Category } from '../../types/catalog'

export function AdminCategoriesPage() {
  const { state, retry } = useAsync(
    (signal) => listAllCategories(signal),
    'admin-categories',
  )
  const [toDelete, setToDelete] = useState<Category | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [message, setMessage] = useState<{
    tone: 'success' | 'error'
    text: string
  }>()

  async function confirmDelete() {
    if (!toDelete) return
    setIsDeleting(true)
    try {
      await deleteCategory(toDelete.id)
      setMessage({ tone: 'success', text: `"${toDelete.name}" was deleted.` })
      retry() // reload the list
    } catch (error) {
      // e.g. 409: the category still has products
      setMessage({ tone: 'error', text: userMessage(error) })
    } finally {
      setIsDeleting(false)
      setToDelete(null)
    }
  }

  return (
    <>
      <title>Categories | Admin</title>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Categories</h1>
        <Link to="/admin/categories/new" className={buttonClasses()}>
          <Plus className="size-4" aria-hidden="true" /> New category
        </Link>
      </div>

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
          <p className="text-slate-600">Loading categories…</p>
        )}
        {state.status === 'error' && (
          <ErrorState description={userMessage(state.error)} onRetry={retry} />
        )}
        {state.status === 'success' && state.data.length === 0 && (
          <EmptyState
            title="No categories yet"
            description="Create your first category to start organising products."
          />
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
                    Slug
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Order
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
                {state.data.map((category) => (
                  <tr key={category.id}>
                    <th
                      scope="row"
                      className="px-4 py-3 font-medium text-slate-900"
                    >
                      {category.name}
                    </th>
                    <td className="px-4 py-3 text-slate-600">
                      {category.slug}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {category.sortOrder}
                    </td>
                    <td className="px-4 py-3">
                      {category.active ? (
                        <Badge tone="success">Visible</Badge>
                      ) : (
                        <Badge>Hidden</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Link
                          to={`/admin/categories/${category.id}/edit`}
                          className={buttonClasses({
                            variant: 'ghost',
                            size: 'sm',
                          })}
                          aria-label={`Edit ${category.name}`}
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </Link>
                        <button
                          type="button"
                          className={buttonClasses({
                            variant: 'ghost',
                            size: 'sm',
                          })}
                          aria-label={`Delete ${category.name}`}
                          onClick={() => {
                            setMessage(undefined)
                            setToDelete(category)
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
        message="This permanently deletes the category. Categories that still have products cannot be deleted; hide them instead."
        confirmLabel="Delete category"
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
        isWorking={isDeleting}
      />
    </>
  )
}
