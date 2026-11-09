import type { ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { Container } from '../../components/layout/Container'
import { buttonClasses } from '../../components/ui/buttonStyles'
import { isAdmin, useAuth } from './AuthContext'

/**
 * A protected route: shows its children only to admins.
 *
 * This only decides what the browser SHOWS. The real protection is on the
 * server (SecurityConfig): even if someone bypassed this check, every admin
 * API call would still be refused with 401/403.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
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
    // Send them to log in, and remember where they wanted to go.
    const redirectTo = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?redirectTo=${redirectTo}`} replace />
  }

  if (!isAdmin(auth)) {
    return (
      <Container className="py-24 text-center">
        <title>Access denied | Leenax SwiftDrop.lk</title>
        <h1 className="text-3xl font-bold text-slate-900">Access denied</h1>
        <p className="mt-3 text-slate-600">
          Your account does not have access to the admin area.
        </p>
        <Link to="/" className={`${buttonClasses()} mt-8`}>
          Go to the home page
        </Link>
      </Container>
    )
  }

  return children
}
