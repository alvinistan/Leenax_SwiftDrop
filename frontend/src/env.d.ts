/// <reference types="vite/client" />

/** Types for our VITE_ environment variables (see frontend/.env.example). */
interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_USE_SAMPLE_DATA?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
