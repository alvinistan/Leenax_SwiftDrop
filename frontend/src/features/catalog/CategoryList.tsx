import type { Category } from '../../types/catalog'

/** Category chips. Phase 4 turns them into real filter links. */
export function CategoryList({ categories }: { categories: Category[] }) {
  return (
    <ul className="flex flex-wrap gap-3">
      {categories.map((category) => (
        <li
          key={category.id}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
        >
          {category.name}
        </li>
      ))}
    </ul>
  )
}
