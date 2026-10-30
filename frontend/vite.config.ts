import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    // The test page's address. Same as the Vite dev server, so CORS behaves as in development.
    environmentOptions: { jsdom: { url: 'http://localhost:5173' } },
    setupFiles: ['./src/test/setup.ts'],
  },
})
