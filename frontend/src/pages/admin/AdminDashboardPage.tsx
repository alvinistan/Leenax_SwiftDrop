import { Package, Tags } from 'lucide-react'
import { Link } from 'react-router'
import { useAuth } from '../../features/auth/AuthContext'

export function AdminDashboardPage() {
  const { auth } = useAuth()
  const name = auth.status === 'authenticated' ? auth.user.displayName : ''

  return (
    <>
      <title>Admin | Leenax SwiftDrop.lk</title>
      <h1 className="text-2xl font-bold text-slate-900">Welcome, {name}</h1>
      <p className="mt-1 text-slate-600">Manage your store's catalogue.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          to="/admin/categories"
          className="rounded-xl border border-slate-200 bg-white p-6 transition hover:shadow-md"
        >
          <Tags className="size-6 text-brand-700" aria-hidden="true" />
          <h2 className="mt-3 font-semibold text-slate-900">Categories</h2>
          <p className="mt-1 text-sm text-slate-600">
            Add, edit, order and hide categories.
          </p>
        </Link>
        <Link
          to="/admin/products"
          className="rounded-xl border border-slate-200 bg-white p-6 transition hover:shadow-md"
        >
          <Package className="size-6 text-brand-700" aria-hidden="true" />
          <h2 className="mt-3 font-semibold text-slate-900">Products</h2>
          <p className="mt-1 text-sm text-slate-600">
            Products, variants (sizes, weights) and stock.
          </p>
        </Link>
      </div>
    </>
  )
}
