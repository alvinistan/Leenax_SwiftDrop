import { LayoutDashboard, LogOut, Package, Store, Tags } from 'lucide-react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { cn } from '../../lib/cn'
import { useAuth } from '../../features/auth/AuthContext'
import { RequireAdmin } from '../../features/auth/RequireAdmin'

const adminLinks = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/categories', label: 'Categories', icon: Tags, end: false },
  { to: '/admin/products', label: 'Products', icon: Package, end: false },
]

/** The admin area's frame: only admins get past RequireAdmin. */
export function AdminLayout() {
  return (
    <RequireAdmin>
      <AdminFrame />
    </RequireAdmin>
  )
}

function AdminFrame() {
  const { auth, logOut } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/admin" className="font-bold text-slate-900">
            SwiftDrop <span className="text-brand-700">Admin</span>
          </Link>
          <div className="flex items-center gap-2 text-sm">
            {auth.status === 'authenticated' && (
              <span className="hidden text-slate-600 sm:inline">
                {auth.user.email}
              </span>
            )}
            <Link
              to="/"
              className="inline-flex items-center gap-1 rounded-lg px-3 py-2 font-medium text-slate-700 hover:bg-slate-100"
            >
              <Store className="size-4" aria-hidden="true" /> View store
            </Link>
            <button
              type="button"
              onClick={async () => {
                await logOut()
                navigate('/login', { replace: true })
              }}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-2 font-medium text-slate-700 hover:bg-slate-100"
            >
              <LogOut className="size-4" aria-hidden="true" /> Log out
            </button>
          </div>
        </div>
        <nav
          aria-label="Admin"
          className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
        >
          <ul className="flex gap-1 overflow-x-auto">
            {adminLinks.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      'inline-flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold',
                      isActive
                        ? 'border-brand-700 text-brand-800'
                        : 'border-transparent text-slate-600 hover:text-slate-900',
                    )
                  }
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  )
}
