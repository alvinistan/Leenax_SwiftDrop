import { NavLink, Outlet } from 'react-router'
import { cn } from '../../../lib/cn'

const links = [
  { to: '/admin/delivery/staff', label: 'Delivery staff' },
  { to: '/admin/delivery/cod', label: 'Cash on delivery' },
]

/** Delivery management: own staff and cash collected on delivery. */
export function AdminDeliveryLayout() {
  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <nav aria-label="Delivery" className="lg:w-56 lg:shrink-0">
        <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Delivery management
        </p>
        <ul className="flex gap-1 overflow-x-auto lg:flex-col">
          {links.map(({ to, label }) => (
            <li key={to} className="shrink-0">
              <NavLink
                to={to}
                className={({ isActive }) =>
                  cn(
                    'block rounded-lg px-3 py-2 text-sm font-medium',
                    isActive
                      ? 'bg-brand-50 text-brand-900'
                      : 'text-slate-700 hover:bg-slate-100',
                  )
                }
              >
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  )
}
