/**
 * Report a client-side error to the API, where it lands in Cloud Logging.
 *
 * A browser error is the only way to learn that the app is broken for patrons,
 * because they do not report it and there is no other channel. Two constraints:
 *
 *  - **Never send user content.** No coordinates, no email, no form values —
 *    only the message, the stack, the route and the band. A patron's location
 *    must never travel on an error report.
 *  - **Never throw and never loop.** Reporting a failure must not itself fail,
 *    and one page must not be able to flood the endpoint.
 *
 * The server side of this is the `POST /client-errors` route in
 * `server/observability/routes.ts`.
 */

function correlationId(): string {
  // `crypto.randomUUID` needs a secure context, which the deployed site always
  // is, but a local http preview during development is not.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 12)
  }
  return Math.random().toString(36).slice(2, 14)
}

export async function reportClientError(input: {
  message: string
  stack?: string
  route: string
  bandSlug?: string
}): Promise<void> {
  try {
    await fetch("/api/client-errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Fire-and-forget, so a hung request must not stall the page.
      signal: AbortSignal.timeout(4000),
      body: JSON.stringify({
        message: input.message.slice(0, 500),
        stack: input.stack?.slice(0, 2000),
        route: input.route.slice(0, 200),
        bandSlug: input.bandSlug?.slice(0, 100),
        correlationId: correlationId(),
      }),
    })
  } catch {
    // Deliberately silent. A failed error report is not worth a user-visible
    // problem, and logging it here would risk a loop.
  }
}

/**
 * Catch errors React did not handle, and unhandled promise rejections.
 * Installed once from `main.tsx`. Returns a teardown for tests.
 */
export function installClientErrorReporting(getRoute: () => string): () => void {
  let reported = 0
  // A render loop can throw on every frame. Cap reports per page load so a
  // broken build cannot become a traffic incident.
  const MAX_REPORTS = 5

  function onError(event: ErrorEvent) {
    if (reported++ >= MAX_REPORTS) return
    void reportClientError({
      message: event.message || "Uncaught error",
      stack: event.error instanceof Error ? event.error.stack : undefined,
      route: getRoute(),
    })
  }
  function onRejection(event: PromiseRejectionEvent) {
    if (reported++ >= MAX_REPORTS) return
    const reason = event.reason
    void reportClientError({
      message: reason instanceof Error ? reason.message : String(reason ?? "Unhandled rejection"),
      stack: reason instanceof Error ? reason.stack : undefined,
      route: getRoute(),
    })
  }

  window.addEventListener("error", onError)
  window.addEventListener("unhandledrejection", onRejection)
  return () => {
    window.removeEventListener("error", onError)
    window.removeEventListener("unhandledrejection", onRejection)
  }
}
