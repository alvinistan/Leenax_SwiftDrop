import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'

type Crumb = { label: string; to?: string }

/** "Home › Cakes & Bakery › Chocolate Cake". The last item is the current page. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-slate-600">
        {items.map((item, index) => (
          <li key={item.label} className="flex items-center gap-1">
            {index > 0 && (
              <ChevronRight
                className="size-4 text-slate-400"
                aria-hidden="true"
              />
            )}
            {item.to ? (
              <Link
                to={item.to}
                className="hover:text-brand-700 hover:underline"
              >
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="font-medium text-slate-900">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
