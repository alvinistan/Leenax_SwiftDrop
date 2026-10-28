import { useState } from 'react'
import { AppLayout } from './components/layout/AppLayout'
import { HomePage } from './pages/HomePage'

function App() {
  // "Lifted" state: App owns the cart count because both the Header (shows it)
  // and the product cards (change it) need it. Preview only: a real cart
  // arrives in Phase 8 and will be stored on the server.
  const [cartCount, setCartCount] = useState(0)

  return (
    <AppLayout cartCount={cartCount}>
      <HomePage onAddToCart={() => setCartCount((count) => count + 1)} />
    </AppLayout>
  )
}

export default App
