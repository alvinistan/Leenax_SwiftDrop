import { Menu, ShoppingBag, X } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink } from 'react-router'
import { cn } from '../../lib/cn'
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
        <Link
          to="/"
          className="text-lg font-bold tracking-tight text-slate-900"
        >
          Leenax <span className="text-brand-700">SwiftDrop</span>
          <span className="text-slate-500">.lk</span>
        </Link>

        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {navigationLinks.map((link) => (
              <li key={link.to}>
                {/* NavLink knows whether its URL is the current page: it adds
                    aria-current="page" and lets us style the active link. */}
                <NavLink
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) =>
                    // Not buttonClasses(): its text colour would clash with the active colour.
                    cn(
                      'inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold transition-colors',
                      isActive
                        ? 'bg-brand-50 text-brand-800'
                        : 'text-slate-700 hover:bg-slate-100',
                    )
                  }
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-1">
          <Link
            to="/cart"
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
          </Link>

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
                <li key={link.to}>
                  <NavLink
                    to={link.to}
                    end={link.end}
                    className={({ isActive }) =>
                      cn(
                        'block rounded-lg px-3 py-3 font-medium hover:bg-slate-100',
                        isActive ? 'text-brand-700' : 'text-slate-800',
                      )
                    }
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {link.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </Container>
        </nav>
      )}
    </header>
  )
}
