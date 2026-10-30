import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
// Adds DOM matchers such as toBeInTheDocument() to Vitest's expect()
import '@testing-library/jest-dom/vitest'
import { server } from './mockApi'

// Start the fake API before all tests. Any request without a handler fails the
// test, so tests can never accidentally call a real server.
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))

afterEach(() => {
  // Remove rendered components and per-test API overrides so tests cannot affect each other.
  cleanup()
  server.resetHandlers()
})

afterAll(() => server.close())
