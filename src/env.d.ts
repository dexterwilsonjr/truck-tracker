/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** When "true", the /admin demo route is available in production builds too. */
  readonly VITE_ENABLE_DEMO_ADMIN?: string
  /** Production API origin. Unset = sales demo (local mock data). */
  readonly VITE_API_URL?: string
  /** Registered client id from `src/config/clients.ts`. Unset = original pack. */
  readonly VITE_BRAND?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
