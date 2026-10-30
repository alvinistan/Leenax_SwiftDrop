import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { buttonClasses } from '../components/ui/buttonStyles'

/**
 * Shown by React Router if a page crashes while rendering (a bug), instead of
 * a blank white screen. It replaces the whole layout, so it must work on its own.
 */
export function RouteErrorPage() {
  const error = useRouteError()
  // Details help developers, but never show them to customers in production.
  console.error(error)
  const status = isRouteErrorResponse(error) ? error.status : undefined

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <title>Something went wrong | Leenax SwiftDrop.lk</title>
      <h1 className="text-3xl font-bold text-slate-900">
        Something went wrong
      </h1>
      <p className="mt-3 max-w-md text-slate-600">
        {status === 404
          ? "We couldn't find that page."
          : 'Sorry, an unexpected error occurred. Please try again.'}
      </p>
      <Link to="/" className={`${buttonClasses()} mt-8`}>
        Go to the home page
      </Link>
    </main>
  )
}
