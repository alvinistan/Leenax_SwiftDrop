import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import '@fontsource-variable/inter'
import './index.css'
import { AuthProvider } from './features/auth/AuthProvider'
import { routes } from './routes'

// A browser router uses real URLs (/products/chocolate-cake) via the History API.
const router = createBrowserRouter(routes)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* AuthProvider wraps the router, so every page can ask who is logged in. */}
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
)
