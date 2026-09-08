import "dotenv/config"
import { serve } from "@hono/node-server"
import { Hono } from "hono"
import type { Context } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"

import { loadSessionUser, type AuthVariables } from "./auth/routes.ts"
import { auth } from "./auth/routes.ts"
import { readSessionUserId } from "./auth/session.ts"
import { migrate, sql } from "./db.ts"
import { loadEnv } from "./env.ts"
import { isLive } from "./entitlements/index.ts"
import { isModuleCode } from "./modules/codes.ts"
import { admin, platform } from "./platform/routes.ts"
import { publicApi } from "./public/bands.ts"
import { UPSELL_CATALOG } from "./public/upsell-catalog.ts"

const env = loadEnv()
await migrate()

const app = new Hono<{ Variables: AuthVariables }>()

app.use("*", logger())
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

app.get("/health", (c) => c.json({ ok: true, product: "truck-tracker", v1: true }))

app.route("/auth", auth)
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

app.get("/me/context", async (c) => {
  const userId = readSessionUserId(c, env)
  const user = userId ? await loadSessionUser(userId) : null
  return c.json({ user })
})

const port = env.port
console.log(`Truck Tracker API on http://127.0.0.1:${port}`)
serve({ fetch: app.fetch, port })
