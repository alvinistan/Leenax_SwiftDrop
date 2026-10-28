import type { ReactNode } from 'react'
import { Footer } from './Footer'
import { Header } from './Header'

type AppLayoutProps = { cartCount: number; children: ReactNode }

/** The frame around every page: skip link, header, main content, footer. */
export function AppLayout({ cartCount, children }: AppLayoutProps) {
  return (
    <div id="top" className="flex min-h-screen flex-col">
      {/* Lets keyboard users jump past the navigation. Visible only when focused. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-20 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow"
      >
        Skip to main content
      </a>
      <Header cartCount={cartCount} />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  )
}
