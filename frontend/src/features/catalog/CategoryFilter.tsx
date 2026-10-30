import { Link } from 'react-router'
import { cn } from '../../lib/cn'
import type { Category } from '../../types/catalog'

type CategoryFilterProps = {
  categories: Category[]
  activeSlug: string | undefined
  /** Builds the link for a category (undefined = all), keeping other URL parameters. */
  hrefFor: (slug: string | undefined) => string
}

/** "All" plus one link per category. The active one is marked with aria-current. */
export function CategoryFilter({
  categories,
  activeSlug,
  hrefFor,
}: CategoryFilterProps) {
  const items = [{ slug: undefined, name: 'All' }, ...categories]

  return (
    <nav aria-label="Filter by category">
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => {
          const isActive = item.slug === activeSlug
          return (
            <li key={item.slug ?? 'all'}>
              <Link
                to={hrefFor(item.slug)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'inline-block rounded-full border px-4 py-1.5 text-sm font-medium transition',
                  isActive
                    ? 'border-brand-700 bg-brand-700 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400',
                )}
              >
                {item.name}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
