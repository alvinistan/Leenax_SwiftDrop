import { Info } from 'lucide-react'
import { buttonClasses } from '../components/ui/buttonStyles'
import { Container } from '../components/layout/Container'
import { CategoryCarousel } from '../features/catalog/CategoryCarousel'
import { ProductGrid } from '../features/catalog/ProductGrid'
import { sampleCategories } from '../features/catalog/sampleData'
import {
  useSampleProducts,
  type DemoMode,
} from '../features/catalog/useSampleProducts'
import { NotifyMeForm } from '../features/launch/NotifyMeForm'
import type { Product } from '../types/catalog'

/** Reads ?demo=empty or ?demo=error from the URL (for previewing screen states). */
function readDemoMode(search: string): DemoMode {
  const demo = new URLSearchParams(search).get('demo')
  return demo === 'empty' || demo === 'error' ? demo : 'normal'
}

type HomePageProps = { onAddToCart: (product: Product) => void }

export function HomePage({ onAddToCart }: HomePageProps) {
  const { status, products, retry } = useSampleProducts(
    readDemoMode(window.location.search),
  )

  return (
    <>
      <section className="border-b border-slate-200 bg-gradient-to-b from-brand-50 to-white">
        <Container className="py-16 sm:py-24">
          <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Everyday essentials, delivered to your door.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-slate-600">
            Leenax SwiftDrop.lk is preparing its first collection. Take a look
            at the preview below and sign up for launch updates.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#products" className={buttonClasses({ size: 'lg' })}>
              Browse the preview
            </a>
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
        <p className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            <strong>Preview:</strong> the products below are samples for design
            purposes. They are not for sale, and prices and stock are not real.
          </span>
        </p>
      </Container>

      <Container className="mt-12">
        <section
          id="categories"
          aria-labelledby="categories-heading"
          className="scroll-mt-20"
        >
          <CategoryCarousel
            categories={sampleCategories}
            header={
              <h2
                id="categories-heading"
                className="text-2xl font-bold text-slate-900"
              >
                Shop by category
              </h2>
            }
          />
        </section>

        <section
          id="products"
          aria-labelledby="products-heading"
          className="mt-16 scroll-mt-20"
        >
          <h2
            id="products-heading"
            className="text-2xl font-bold text-slate-900"
          >
            Featured products
          </h2>
          <div className="mt-6">
            <ProductGrid
              status={status}
              products={products}
              onRetry={retry}
              onAddToCart={onAddToCart}
            />
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
