import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { sql } from "../db.ts"
import { activateEntitlement, revokeEntitlement } from "../billing/adapter.ts"
import { liveModules } from "../entitlements/index.ts"
import { isModuleCode, MODULE_CODES, type ModuleCode } from "../modules/codes.ts"
import { requireUser, isBandOrganizer, type AuthVariables } from "../auth/routes.ts"
import { hashPassword, randomToken } from "../auth/passwords.ts"
import { rateLimit } from "../auth/rate-limit.ts"
import { body, string, uuid, page } from "../validation.ts"

export const platform = new Hono<{ Variables: AuthVariables }>()
export const admin = new Hono<{ Variables: AuthVariables }>()
platform.use("*", async (c, next) => {
  const actor = await requireUser(c)
  if (actor instanceof Response) return actor
  if (actor.platformRole !== "platform_admin") throw new HTTPException(403, { message: "Platform admin only." })
  await next()
})
platform.get("/bands", async c => {
  const offset = page(c.req.query("page")) * 25
  const rows = await sql<{ id: string; slug: string; name: string; event_year: number; entitlements: ModuleCode[] }[]>`
    SELECT b.id, b.slug, b.name, b.event_year,
      COALESCE(array_agg(e.module_code) FILTER (WHERE e.module_code IS NOT NULL), ARRAY[]::text[]) AS entitlements
    FROM (SELECT * FROM bands ORDER BY name, id LIMIT 26 OFFSET ${offset}) b
    LEFT JOIN band_entitlements e ON e.band_id = b.id AND e.status = 'active'
      AND e.starts_at <= now() AND (e.ends_at IS NULL OR e.ends_at > now())
    GROUP BY b.id, b.slug, b.name, b.event_year ORDER BY b.name, b.id`
  return c.json({ bands: rows.slice(0, 25).map(b => ({ ...b, eventYear: b.event_year, liveModules: liveModules(b.entitlements) })), hasMore: rows.length > 25, catalog: MODULE_CODES })
})
platform.get("/users", async c => {
  const rows = await sql`SELECT id, email, name, platform_role FROM users ORDER BY email, id LIMIT 26 OFFSET ${page(c.req.query("page")) * 25}`
  return c.json({ users: rows.slice(0, 25), hasMore: rows.length > 25 })
})
platform.get("/requests", async c => {
  const rows = await sql`SELECT r.module_code, r.requested_at, b.name AS band_name, u.email
    FROM module_requests r JOIN bands b ON b.id = r.band_id JOIN users u ON u.id = r.user_id
    ORDER BY r.requested_at DESC LIMIT 26 OFFSET ${page(c.req.query("page")) * 25}`
  return c.json({ requests: rows.slice(0, 25), hasMore: rows.length > 25 })
})
platform.post("/bands/:id/entitlements", async c => {
  const data = await body(c)
  const code = string(data.moduleCode, "Module")
  if (!isModuleCode(code)) throw new HTTPException(400, { message: "Unknown module." })
  const bandId = uuid(c.req.param("id"))
  if (!(await sql`SELECT id FROM bands WHERE id = ${bandId}::uuid`).length) throw new HTTPException(404)
  await activateEntitlement({ bandId, moduleCode: code, source: "manual" })
  return c.json({ ok: true })
})
platform.delete("/bands/:id/entitlements/:moduleCode", async c => {
  const code = c.req.param("moduleCode")
  if (!isModuleCode(code)) throw new HTTPException(400, { message: "Unknown module." })
  await revokeEntitlement({ bandId: uuid(c.req.param("id")), moduleCode: code, reason: "platform_admin" })
  return c.json({ ok: true })
})
// Both routes use the same target-aware policy. Organizers may reset only
// marshals belonging exclusively to their band; platform staff handle peers.
for (const router of [admin, platform]) {
  router.post("/users/:id/password", async c => {
    const actor = await requireUser(c)
    if (actor instanceof Response) return actor
    const target = uuid(c.req.param("id"))
    const data = await body(c)
    const bandId = data.bandId === undefined ? null : uuid(data.bandId)
    await rateLimit(c, "admin-reset", actor.id)
    const temporary = data.temporaryPassword === undefined ? randomToken().slice(0, 24) : string(data.temporaryPassword, "Temporary password", 12, 128)
    const hash = await hashPassword(temporary)
    await sql.begin(async tx => {
      const rows = await tx<{ platform_role: string }[]>`SELECT platform_role FROM users WHERE id = ${target}::uuid FOR UPDATE`
      if (actor.platformRole !== "platform_admin") {
        if (!bandId || !isBandOrganizer(actor, bandId) || rows[0]?.platform_role !== "patron") throw new HTTPException(403, { message: "You cannot reset this account." })
        const memberships = await tx<{ band_id: string; role: string }[]>`SELECT band_id, role FROM band_members WHERE user_id = ${target}::uuid FOR UPDATE`
        if (memberships.length !== 1 || memberships[0]?.band_id !== bandId || memberships[0]?.role !== "marshal") throw new HTTPException(403, { message: "Only marshals assigned exclusively to your band can be reset here." })
      }
      if (!rows[0]) throw new HTTPException(404, { message: "User not found." })
      await tx`UPDATE users SET password_hash = ${hash}, must_reset_password = true WHERE id = ${target}::uuid`
      await tx`DELETE FROM sessions WHERE user_id = ${target}::uuid`
      await tx`UPDATE password_reset_tokens SET used_at = now() WHERE user_id = ${target}::uuid AND used_at IS NULL`
    })
    return c.json({ ok: true, temporaryPassword: temporary })
  })
}
admin.post("/bands/:id/requests", async c => {
  const actor = await requireUser(c)
  if (actor instanceof Response) return actor
  const bandId = uuid(c.req.param("id"))
  if (!isBandOrganizer(actor, bandId)) throw new HTTPException(403, { message: "Ask your organizer to request this feature." })
  const data = await body(c)
  const code = string(data.moduleCode, "Module")
  if (!isModuleCode(code)) throw new HTTPException(400)
  await sql`INSERT INTO module_requests (band_id, module_code, user_id) VALUES (${bandId}::uuid, ${code}, ${actor.id}::uuid)
    ON CONFLICT (band_id, module_code) DO UPDATE SET user_id = EXCLUDED.user_id, requested_at = now()`
  return c.json({ ok: true })
})
