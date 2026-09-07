/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** When "true", the /admin demo route is available in production builds too. */
  readonly VITE_ENABLE_DEMO_ADMIN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
