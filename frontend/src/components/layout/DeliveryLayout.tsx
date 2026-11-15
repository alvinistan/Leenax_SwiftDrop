import { LogOut } from 'lucide-react'
import { Link, Outlet, useNavigate } from 'react-router'
import { useAuth } from '../../features/auth/AuthContext'
import { RequireDelivery } from '../../features/auth/RequireDelivery'

/** The delivery staff pages: a simple frame made for phones. */
export function DeliveryLayout() {
  return (
    <RequireDelivery>
      <DeliveryFrame />
    </RequireDelivery>
  )
}

function DeliveryFrame() {
  const { auth, logOut } = useAuth()
  const navigate = useNavigate()
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-xl items-center justify-between gap-3 px-4">
          <Link to="/delivery" className="font-bold text-slate-900">
            SwiftDrop <span className="text-brand-700">Deliveries</span>
          </Link>
          <div className="flex items-center gap-2 text-sm">
            {auth.status === 'authenticated' && (
              <span className="hidden text-slate-600 sm:inline">
                {auth.user.displayName}
              </span>
            )}
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
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
