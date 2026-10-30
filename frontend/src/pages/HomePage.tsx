import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { Container } from '../components/layout/Container'
import { buttonClasses } from '../components/ui/buttonStyles'
import { Skeleton } from '../components/ui/Skeleton'
import { listCategories, listProducts } from '../features/catalog/catalogApi'
import { CategoryCarousel } from '../features/catalog/CategoryCarousel'
import { ProductGrid } from '../features/catalog/ProductGrid'
import { SampleDataNotice } from '../features/catalog/SampleDataNotice'
import { NotifyMeForm } from '../features/launch/NotifyMeForm'
import { useAsync, type AsyncState } from '../hooks/useAsync'
import type { Category } from '../types/catalog'

export function HomePage() {
  const categories = useAsync((signal) => listCategories(signal), 'categories')
  const featured = useAsync(
    (signal) => listProducts({ size: 8 }, signal).then((page) => page.content),
    'featured',
  )

  return (
    <>
      <title>Leenax SwiftDrop.lk</title>
      <section className="border-b border-slate-200 bg-gradient-to-b from-brand-50 to-white">
        <Container className="py-16 sm:py-24">
          <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Everyday essentials, delivered to your door.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-slate-600">
            Leenax SwiftDrop.lk is preparing its first collection. Take a look
            at the preview and sign up for launch updates.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/products" className={buttonClasses({ size: 'lg' })}>
              Browse the shop
            </Link>
            <a
              href="#launch-updates"
              className={buttonClasses({ variant: 'secondary', size: 'lg' })}
            >
              Get launch updates
            </a>
          </div>
        </Container>
      </section>

      <Container className="mt-8">
        <SampleDataNotice />
      </Container>

      <Container className="mt-12">
        <section aria-labelledby="categories-heading">
          <CategorySection state={categories.state} />
        </section>

        <section aria-labelledby="products-heading" className="mt-16">
          <div className="flex items-end justify-between gap-4">
            <h2
              id="products-heading"
              className="text-2xl font-bold text-slate-900"
            >
              New arrivals
            </h2>
            <Link
              to="/products"
              className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"
            >
              View all <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-6">
            <ProductGrid state={featured.state} onRetry={featured.retry} />
          </div>
        </section>

        <section
          id="launch-updates"
          aria-labelledby="launch-heading"
          className="mt-20 scroll-mt-20 rounded-2xl border border-slate-200 bg-slate-50 p-6 sm:p-10"
        >
          <h2 id="launch-heading" className="text-2xl font-bold text-slate-900">
            Be the first to know
          </h2>
          <p className="mt-2 max-w-xl text-slate-600">
            Leave your email and we'll tell you when the store opens.
          </p>
          <div className="mt-6 max-w-xl">
            <NotifyMeForm />
          </div>
        </section>
      </Container>
    </>
  )
}

const categoriesHeading = (
  <h2 id="categories-heading" className="text-2xl font-bold text-slate-900">
    Shop by category
  </h2>
)

/** The carousel once loaded; placeholders while loading; a short note if empty or failed. */
function CategorySection({ state }: { state: AsyncState<Category[]> }) {
  if (state.status === 'success' && state.data.length > 0) {
    return (
      <CategoryCarousel categories={state.data} header={categoriesHeading} />
    )
  }
  return (
    <>
      {categoriesHeading}
      {state.status === 'loading' ? (
        <div className="mt-4 flex gap-6" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton
              key={i}
              className="size-24 shrink-0 rounded-full sm:size-28"
            />
          ))}
        </div>
      ) : (
        // Failed or empty: the products section below shows any error with a retry button.
        <p className="mt-3 text-slate-600">Categories will appear here soon.</p>
      )}
    </>
  )
}
