import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Category } from '../../types/catalog'
import { CategoryImage } from './CategoryImage'

type CategoryCarouselProps = {
  categories: Category[]
  /** Shown on the left of the Previous/Next buttons, e.g. a section heading. */
  header?: ReactNode
}

/**
 * A horizontal row of round category pictures.
 * - Phones: swipe left and right (native scrolling with snap points).
 * - All devices: Previous / Next buttons move one "page" at a time.
 * - Keyboard: Tab to the row, then use the arrow keys.
 * Phase 4 turns each category into a link to its product listing.
 */
export function CategoryCarousel({
  categories,
  header,
}: CategoryCarouselProps) {
  // useRef gives direct access to the scrolling <ul> element in the page.
  const listRef = useRef<HTMLUListElement>(null)
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)

  function updateButtons() {
    const list = listRef.current
    if (!list) return
    setCanScrollPrev(list.scrollLeft > 0)
    // -1 allows for rounding when the browser is zoomed.
    setCanScrollNext(list.scrollLeft + list.clientWidth < list.scrollWidth - 1)
  }

  useEffect(() => {
    updateButtons()
    // The row's width changes when the window is resized.
    window.addEventListener('resize', updateButtons)
    // Cleanup: remove the listener when the component disappears.
    return () => window.removeEventListener('resize', updateButtons)
  }, [categories])

  function scrollByPage(direction: 1 | -1) {
    const list = listRef.current
    if (!list) return
    const reduceMotion = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches
    list.scrollBy({
      // Move 80% of the visible width so one item stays in view for context.
      left: direction * list.clientWidth * 0.8,
      behavior: reduceMotion ? 'auto' : 'smooth',
    })
  }

  const arrowClasses =
    'flex size-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>{header}</div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            className={arrowClasses}
            onClick={() => scrollByPage(-1)}
            disabled={!canScrollPrev}
            aria-label="Previous categories"
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={arrowClasses}
            onClick={() => scrollByPage(1)}
            disabled={!canScrollNext}
            aria-label="Next categories"
          >
            <ChevronRight className="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <ul
        ref={listRef}
        onScroll={updateButtons}
        // A scrollable area must be reachable by keyboard (arrow keys scroll it).
        tabIndex={0}
        aria-label="Categories"
        className="scrollbar-none mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 sm:gap-6"
      >
        {categories.map((category) => (
          <li key={category.id} className="w-24 shrink-0 snap-start sm:w-28">
            <div className="aspect-square overflow-hidden rounded-full border border-slate-200 bg-white p-1">
              <CategoryImage category={category} />
            </div>
            <p className="mt-2 text-center text-sm font-medium leading-tight text-slate-800">
              {category.name}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
