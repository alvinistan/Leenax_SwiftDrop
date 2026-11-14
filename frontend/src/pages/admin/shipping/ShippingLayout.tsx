import { NavLink, Outlet } from 'react-router'
import { cn } from '../../../lib/cn'

const links = [
  { to: '/admin/shipping', label: 'Overview', end: true },
  { to: '/admin/shipping/providers', label: 'Couriers' },
  { to: '/admin/shipping/rate-cards', label: 'Rate cards' },
  { to: '/admin/shipping/markup', label: 'Platform fee' },
  { to: '/admin/shipping/restrictions', label: 'Country restrictions' },
  { to: '/admin/shipping/settings', label: 'Pickup & boxes' },
  { to: '/admin/shipping/simulator', label: 'Quote simulator' },
  { to: '/admin/shipping/history', label: 'Change history' },
]

/** Shipping management: a sub-menu above every shipping page. */
export function ShippingLayout() {
  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <nav aria-label="Shipping" className="lg:w-56 lg:shrink-0">
        <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Shipping management
        </p>
        <ul className="flex gap-1 overflow-x-auto lg:flex-col">
          {links.map(({ to, label, end }) => (
            <li key={to} className="shrink-0">
              <NavLink
                to={to}
                end={end}
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
