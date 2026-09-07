/**
 * The demo admin route is a local-only experiment surface, not security:
 * it has no authentication by design.
 *
 * It ships DISABLED in production builds. To preview it in a production
 * build, set VITE_ENABLE_DEMO_ADMIN="true".
 */
export function demoAdminEnabled(): boolean {
  return (
    import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_ADMIN === "true"
  )
}
