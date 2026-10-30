import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { buttonClasses } from '../ui/buttonStyles'

type PaginationProps = {
  /** 1-based, as shown to people and stored in the URL */
  page: number
  totalPages: number
  hrefFor: (page: number) => string
}

/** Previous / Next links. Real links, so pages can be bookmarked and opened in new tabs. */
export function Pagination({ page, totalPages, hrefFor }: PaginationProps) {
  if (totalPages <= 1) return null

  const linkClasses = buttonClasses({ variant: 'secondary', size: 'sm' })
  const disabledClasses = `${linkClasses} pointer-events-none opacity-40`

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-4"
    >
      {page > 1 ? (
        <Link to={hrefFor(page - 1)} className={linkClasses} rel="prev">
          <ChevronLeft className="size-4" aria-hidden="true" /> Previous
        </Link>
      ) : (
        <span className={disabledClasses} aria-hidden="true">
          <ChevronLeft className="size-4" /> Previous
        </span>
      )}

      <p className="text-sm text-slate-600">
        Page {page} of {totalPages}
      </p>

      {page < totalPages ? (
        <Link to={hrefFor(page + 1)} className={linkClasses} rel="next">
          Next <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      ) : (
        <span className={disabledClasses} aria-hidden="true">
          Next <ChevronRight className="size-4" />
        </span>
      )}
    </nav>
  )
}
