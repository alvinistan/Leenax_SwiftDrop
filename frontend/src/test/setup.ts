import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
// Adds DOM matchers such as toBeInTheDocument() to Vitest's expect()
import '@testing-library/jest-dom/vitest'

// Remove rendered components after each test so tests cannot affect each other.
afterEach(() => {
  cleanup()
})
