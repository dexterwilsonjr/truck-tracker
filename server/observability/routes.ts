import { Hono } from "hono"

import { rateLimit } from "../auth/rate-limit.ts"
import { body, string } from "../validation.ts"
import { liveness, readiness } from "./health.ts"
import { log, newCorrelationId } from "./log.ts"

/**
 * Receive browser errors and put them in Cloud Logging.
 *
 * Public and unauthenticated by necessity: a patron can hit a broken page before
 * they have ever signed in, and that is exactly the case worth knowing about.
 * That makes this a public write endpoint, so the payload is bounded and
 * sanitised, and it must never become a way to store arbitrary data.
 *
 * Every response carries a short correlation id. A user can read it to support,
 * and it identifies the exact request and stack in the logs, which is the only
 * reason this endpoint earns its place.
 */
export const clientErrors = new Hono()

clientErrors.post("/", async (c) => {
  // The global bucket is the only meaningful control here — there is no account
  // to key on — and it is deliberately generous. Throttling error reports during
  // a real outage would hide the very thing we need to see.
  await rateLimit(c, "client-error", "", 5000, { global: 20_000 })

  const data = await body(c)
  const message = string(data.message, "Message", 1, 500)
  const route = typeof data.route === "string" ? data.route.slice(0, 200) : "(unknown)"
  const bandSlug = typeof data.bandSlug === "string" ? data.bandSlug.slice(0, 100) : null
  const stack = typeof data.stack === "string" ? data.stack.slice(0, 2000) : null
  const correlationId = newCorrelationId()

  // Every field is bounded above and redacted again inside `log`, so a
  // coordinate or a token echoed into a message cannot survive into the logs.
  log.error("Client error", {
    where: "browser",
    route,
    bandSlug,
    clientMessage: message,
    ...(stack ? { clientStack: stack } : {}),
    userAgent: c.req.header("user-agent")?.slice(0, 200) ?? null,
  }, correlationId)

  return c.json({ ok: true, correlationId }, 202)
})

/**
 * Readiness detail for the operations dashboard.
 *
 * `/live` is cheap and safe for a platform uptime check. `/ready` additionally
 * reports whether the connection pool has been starved by transactions that
 * stopped working, which is the state the API silently died in during this
 * build. Both are unauthenticated, so neither reveals anything but its own
 * verdict and a connection count.
 */
export const health = new Hono()

health.get("/live", async (c) => {
  const report = await liveness()
  return c.json(report, report.ok ? 200 : 503)
})

health.get("/ready", async (c) => {
  const report = await readiness()
  if (!report.ok) {
    log.warn("Readiness check failed", {
      where: "readiness",
      idleInTransaction: report.idleInTransaction,
      poolStarved: report.poolStarved,
      databaseMs: report.databaseMs,
    })
  }
  return c.json(report, report.ok ? 200 : 503)
})
