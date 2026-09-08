import { Hono } from "hono"

import { sql } from "../db.ts"
import { activateEntitlement, revokeEntitlement } from "../billing/adapter.ts"
import { entitledModules, liveModules } from "../entitlements/index.ts"
import { isModuleCode, MODULE_CODES } from "../modules/codes.ts"
import type { AuthVariables } from "../auth/routes.ts"
import { hashPassword } from "../auth/passwords.ts"
import { isBandOrganizer, requireUser, type SessionUser } from "../auth/routes.ts"

export const platform = new Hono<{ Variables: AuthVariables }>()

platform.use("*", async (c, next) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user
  if (user.platformRole !== "platform_admin") {
    return c.json(
      { error: { code: "forbidden", message: "Platform admin only." } },
      403,
    )
  }
  await next()
})

platform.get("/bands", async (c) => {
  const rows = await sql<
    { id: string; slug: string; name: string; event_year: number }[]
  >`
    SELECT id, slug, name, event_year FROM bands ORDER BY name
  `
  const bands = await Promise.all(
    rows.map(async (band) => {
      const entitled = await entitledModules(band.id)
      return {
        ...band,
        eventYear: band.event_year,
        entitlements: entitled,
        liveModules: liveModules(entitled),
      }
    }),
  )
  return c.json({ bands, catalog: MODULE_CODES })
})

platform.post("/bands/:id/entitlements", async (c) => {
  const bandId = c.req.param("id")
  const body = await c.req.json<{
    moduleCode?: string
    source?: "manual" | "custom_billing"
    planCode?: string
    invoiceRef?: string
  }>()
  const code = body.moduleCode ?? ""
  if (!isModuleCode(code)) {
    return c.json({ error: { code: "unknown_module", message: "Unknown module." } }, 400)
  }
  await activateEntitlement({
    bandId,
    moduleCode: code,
    source: body.source ?? "manual",
    planCode: body.planCode,
    invoiceRef: body.invoiceRef,
  })
  return c.json({ ok: true })
})

platform.delete("/bands/:id/entitlements/:moduleCode", async (c) => {
  const bandId = c.req.param("id")
  const code = c.req.param("moduleCode")
  if (!isModuleCode(code)) {
    return c.json({ error: { code: "unknown_module", message: "Unknown module." } }, 400)
  }
  await revokeEntitlement({
    bandId,
    moduleCode: code,
    reason: "platform_admin",
  })
  return c.json({ ok: true })
})

platform.post("/users/:id/password", async (c) => {
  const userId = c.req.param("id")
  const body = await c.req.json<{ temporaryPassword?: string }>()
  const temporary =
    body.temporaryPassword && body.temporaryPassword.length >= 8
      ? body.temporaryPassword
      : randomTempPassword()
  const passwordHash = await hashPassword(temporary)
  const updated = await sql<{ id: string }[]>`
    UPDATE users
    SET password_hash = ${passwordHash}, must_reset_password = true
    WHERE id = ${userId}::uuid
    RETURNING id
  `
  if (!updated[0]) {
    return c.json({ error: { code: "user_not_found", message: "No such user." } }, 404)
  }
  return c.json({ ok: true, temporaryPassword: temporary })
})

platform.get("/users", async (c) => {
  const rows = await sql<
    { id: string; email: string; name: string; platform_role: string }[]
  >`
    SELECT id, email, name, platform_role FROM users ORDER BY email
  `
  return c.json({ users: rows })
})

function randomTempPassword(): string {
  return `tmp-${Math.random().toString(36).slice(2, 10)}aA1`
}

export const admin = new Hono<{ Variables: AuthVariables }>()

admin.post("/users/:id/password", async (c) => {
  const actor = await requireUser(c)
  if (actor instanceof Response) return actor
  const userId = c.req.param("id")
  const body = await c.req.json<{
    temporaryPassword?: string
    bandId?: string
  }>()
  if (!canResetUser(actor, body.bandId)) {
    return c.json(
      { error: { code: "forbidden", message: "Organizer or platform admin only." } },
      403,
    )
  }
  const temporary =
    body.temporaryPassword && body.temporaryPassword.length >= 8
      ? body.temporaryPassword
      : randomTempPassword()
  const passwordHash = await hashPassword(temporary)
  const updated = await sql<{ id: string }[]>`
    UPDATE users
    SET password_hash = ${passwordHash}, must_reset_password = true
    WHERE id = ${userId}::uuid
    RETURNING id
  `
  if (!updated[0]) {
    return c.json({ error: { code: "user_not_found", message: "No such user." } }, 404)
  }
  return c.json({ ok: true, temporaryPassword: temporary })
})

function canResetUser(actor: SessionUser, bandId?: string): boolean {
  if (actor.platformRole === "platform_admin") return true
  if (!bandId) return false
  return isBandOrganizer(actor, bandId)
}
