import { Menu, ShoppingBag, X } from 'lucide-react'
import { useState } from 'react'
import { buttonClasses } from '../ui/buttonStyles'
import { Container } from './Container'
import { navigationLinks } from './navigation'

type HeaderProps = {
  /** Number of items in the cart. */
  cartCount: number
}

export function Header({ cartCount }: HeaderProps) {
  // State: whether the mobile menu is open. Changing it re-renders the header.
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const cartLabel = `Cart, ${cartCount} ${cartCount === 1 ? 'item' : 'items'}`

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-4">
        <a
          href="#top"
          className="text-lg font-bold tracking-tight text-slate-900"
        >
          Leenax <span className="text-brand-700">SwiftDrop</span>
          <span className="text-slate-500">.lk</span>
        </a>

        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {navigationLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className={buttonClasses({ variant: 'ghost', size: 'sm' })}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-1">
          <a
            href="#cart"
            aria-label={cartLabel}
            className={buttonClasses({ variant: 'ghost', size: 'sm' })}
          >
            <ShoppingBag className="size-5" aria-hidden="true" />
            <span
              aria-hidden="true"
              className="min-w-5 rounded-full bg-brand-700 px-1.5 text-center text-xs font-semibold leading-5 text-white"
            >
              {cartCount}
            </span>
          </a>

          <button
            type="button"
            className={`${buttonClasses({ variant: 'ghost', size: 'sm' })} md:hidden`}
            aria-expanded={isMenuOpen}
            aria-controls="mobile-menu"
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            {isMenuOpen ? (
              <X className="size-5" aria-hidden="true" />
            ) : (
              <Menu className="size-5" aria-hidden="true" />
            )}
            <span className="sr-only">
              {isMenuOpen ? 'Close menu' : 'Open menu'}
            </span>
          </button>
        </div>
      </Container>

      {isMenuOpen && (
        <nav
          id="mobile-menu"
          aria-label="Mobile"
          className="border-t border-slate-200 md:hidden"
        >
          <Container className="py-2">
            <ul className="flex flex-col">
              {navigationLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="block rounded-lg px-3 py-3 font-medium text-slate-800 hover:bg-slate-100"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </Container>
        </nav>
      )}
    </header>
  )
}
