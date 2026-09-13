import "dotenv/config"
import { serve } from "@hono/node-server"
import { Hono } from "hono"
import type { Context } from "hono"
import { cors } from "hono/cors"
import { HTTPException } from "hono/http-exception"
import { bodyLimit } from "hono/body-limit"
import { friends } from "./modules/friends/index.ts"
import { tracker } from "./modules/truck_tracker/index.ts"
import { clientErrors, health } from "./observability/routes.ts"
import { captureError, log, newCorrelationId } from "./observability/log.ts"

import { type AuthVariables } from "./auth/routes.ts"
import { auth } from "./auth/routes.ts"
import { migrate, sql } from "./db.ts"
import { startMaintenance } from "./maintenance.ts"
import { loadEnv } from "./env.ts"
import { isLive } from "./entitlements/index.ts"
import { isModuleCode } from "./modules/codes.ts"
import { admin, platform } from "./platform/routes.ts"
import { publicApi } from "./public/bands.ts"
import { UPSELL_CATALOG } from "./public/upsell-catalog.ts"

const env = loadEnv()


export const app = new Hono<{ Variables: AuthVariables }>().basePath("/api")

/**
 * Routes called by the native app's SDK, not by the browser.
 *
 * A native HTTP client cannot send our web Origin, so these are exempt from the
 * origin guard and authenticate with a device bearer token instead. Keep this
 * list to exactly the ingest path: every entry sits outside CSRF protection, so
 * it must never include a route that trusts the session cookie.
 */
function isNativeIngest(path: string): boolean {
  return path === "/friends/positions" || path === "/api/friends/positions"
}

// The ingest batches several queued points per request, so it gets its own
// bound. Everything else keeps the small web limit.
const WEB_BODY_LIMIT = bodyLimit({ maxSize: 16384 })

app.use("*", async (c, next) => {
  if (isNativeIngest(c.req.path)) return next()
  return WEB_BODY_LIMIT(c, next)
})
app.use("*", async (c, next) => {
  c.header("Cache-Control", "no-store")
  c.header("X-Content-Type-Options", "nosniff")
  c.header("Referrer-Policy", "no-referrer")
  const origin = c.req.header("origin")
  if (
    !["GET", "HEAD", "OPTIONS"].includes(c.req.method) &&
    origin !== env.frontendOrigin &&
    !isNativeIngest(c.req.path)
  ) {
    return c.json({ error: { code: "forbidden", message: "Request origin is not allowed." } }, 403)
  }
  await next()
})
app.onError((error, c) => {
  if (error instanceof HTTPException) {
    // Deliberately not logged here. The request logger below already records
    // every 4xx with the same path and status, and logging it twice made the
    // output harder to read for no extra information.
    return c.json({ error: { code: "request_failed", message: error.message } }, error.status)
  }
  // 5xx is an incident: capture the stack and give the user an id they can
  // quote. The stack stays server-side; the id is what crosses the boundary.
  const correlationId = newCorrelationId()
  captureError(error, { where: "request", path: c.req.path, method: c.req.method }, { correlationId, includeStack: true })
  return c.json({ error: { code: "server_error", message: "Service temporarily unavailable. Please try again.", correlationId } }, 500)
})
app.use(
  "*",
  cors({
    origin: env.frontendOrigin,
    credentials: true,
    allowHeaders: ["Content-Type"],
    allowMethods: ["GET", "POST", "DELETE", "PATCH", "OPTIONS"],
  }),
)

app.use("*", async (c, next) => {
  c.set("env", env)
  c.set("user", null)
  await next()
})

/**
 * One structured line per request.
 *
 * Deliberately excludes the query string, which can carry an invite or reset
 * token, and only records the status for API traffic. Health and error reports
 * are skipped because they would otherwise dominate the logs.
 */
app.use("*", async (c, next) => {
  const started = Date.now()
  await next()
  const path = c.req.path
  if (path.endsWith("/health") || path.endsWith("/health/live")) return
  const status = c.res.status
  const fields = { where: "request", method: c.req.method, path, status, ms: Date.now() - started }
  if (status >= 500) log.error("Request failed", fields)
  else if (status >= 400) log.warn("Request rejected", fields)
  else log.info("Request", fields)
})

app.get("/health", async (c) => { await sql`SELECT 1`; return c.json({ ok: true, product: "truck-tracker", version: "1.2.0" }) })

// Split health: /health/live for an uptime check, /health/ready for the pool
// starvation check that catches the silent-death state.
app.route("/health", health)
app.route("/client-errors", clientErrors)

app.route("/auth", auth)
app.route("/", tracker)
app.route("/friends", friends)
app.route("/public", publicApi)
app.route("/platform", platform)
app.route("/admin", admin)

app.all("/modules/:moduleCode", moduleGate)
app.all("/modules/:moduleCode/*", moduleGate)

async function moduleGate(c: Context<{ Variables: AuthVariables }>) {
  const code = c.req.param("moduleCode") ?? ""
  if (!isModuleCode(code)) {
    return c.json({ error: { code: "unknown_module", message: "Unknown module." } }, 404)
  }
  const slug = c.req.query("band") ?? ""
  const bands = await sql<{ id: string }[]>`
    SELECT id FROM bands WHERE slug = ${slug}
  `
  const band = bands[0]
  if (!band) {
    return c.json(
      { error: { code: "band_not_found", message: "That band is not on Truck Tracker." } },
      404,
    )
  }
  const live = await isLive(band.id, code)
  if (!live) {
    return c.json(
      {
        error: {
          code: "module_not_entitled",
          module: code,
          upsell: UPSELL_CATALOG[code],
        },
      },
      403,
    )
  }
  return c.json(
    {
      error: {
        code: "not_deployed",
        message: "Package is entitled but not in this build.",
      },
    },
    503,
  )
}

if (process.env.NODE_ENV !== "test") {
  await migrate()
  startMaintenance()
  const server = serve({ fetch: app.fetch, port: env.port })
  console.info(`Truck Tracker 1.2 API listening on port ${env.port}`)
  process.on("SIGTERM", () => { server.close(); void sql.end({ timeout: 5 }) })
}
