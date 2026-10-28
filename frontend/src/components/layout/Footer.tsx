import { Container } from './Container'

// Calculated once when the app loads, not on every render.
const currentYear = new Date().getFullYear()

export function Footer() {
  return (
    <footer className="mt-24 border-t border-slate-200 bg-slate-50">
      <Container className="flex flex-col gap-2 py-10 text-sm text-slate-600 sm:flex-row sm:justify-between">
        <p>© {currentYear} Leenax SwiftDrop.lk. All rights reserved.</p>
        <p>Store policies and contact details coming soon.</p>
      </Container>
    </footer>
  )
}
