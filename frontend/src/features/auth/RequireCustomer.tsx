import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { Container } from '../../components/layout/Container'
import { isCustomer, useAuth } from './AuthContext'

/**
 * Pages for customers (checkout, my orders). Visitors are sent to log in and
 * come back here afterwards. The server checks again on every request.
 */
export function RequireCustomer({ children }: { children: ReactNode }) {
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
  if (!isCustomer(auth)) {
    return (
      <Container className="py-24 text-center">
        <h1 className="text-3xl font-bold text-slate-900">
          Customer account needed
        </h1>
        <p className="mt-3 text-slate-600">
          Orders are placed with a customer account. Log out of the admin
          account and log in or sign up as a customer.
        </p>
      </Container>
    )
  }
  return children
}
