import { Link } from 'react-router'
import { Container } from '../components/layout/Container'
import { buttonClasses } from '../components/ui/buttonStyles'

type NotFoundContentProps = { title?: string; message?: string }

/** Shared "not found" message, used for unknown URLs and unknown products. */
export function NotFoundContent({
  title = 'Page not found',
  message = "We couldn't find the page you were looking for. It may have moved, or the link may be wrong.",
}: NotFoundContentProps) {
  return (
    <Container className="py-24 text-center">
      <title>{`${title} | Leenax SwiftDrop.lk`}</title>
      <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">
        404
      </p>
      <h1 className="mt-2 text-3xl font-bold text-slate-900">{title}</h1>
      <p className="mx-auto mt-3 max-w-md text-slate-600">{message}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/" className={buttonClasses()}>
          Go to the home page
        </Link>
        <Link
          to="/products"
          className={buttonClasses({ variant: 'secondary' })}
        >
          Browse products
        </Link>
      </div>
    </Container>
  )
}

/** The "*" route: any URL that matches no other route. */
export function NotFoundPage() {
  return <NotFoundContent />
}
