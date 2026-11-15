import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { Container } from '../../components/layout/Container'
import { isDeliveryStaff, useAuth } from './AuthContext'

/**
 * Pages for delivery staff. The server checks again on every request (and
 * refuses accounts the owner has disabled).
 */
export function RequireDelivery({ children }: { children: ReactNode }) {
  const { auth } = useAuth()
  const location = useLocation()

  if (auth.status === 'loading') {
    return (
      <p role="status" className="p-8 text-center text-slate-600">
        Checking your login…
      </p>
    )
  }
  if (auth.status === 'anonymous') {
    const redirectTo = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?redirectTo=${redirectTo}`} replace />
  }
  if (!isDeliveryStaff(auth)) {
    return (
      <Container className="py-24 text-center">
        <title>Access denied | Leenax SwiftDrop.lk</title>
        <h1 className="text-3xl font-bold text-slate-900">Access denied</h1>
        <p className="mt-3 text-slate-600">
          These pages are for SwiftDrop delivery staff.
        </p>
      </Container>
    )
  }
  return children
}
