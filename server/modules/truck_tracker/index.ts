import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { sql } from "../../db.ts"
import { requireUser, isOrganizerFor, type AuthVariables } from "../../auth/routes.ts"
import { isLive } from "../../entitlements/index.ts"
import { body, string, uuid } from "../../validation.ts"
import { pickPosition, validPosition, type Position } from "./snapshot.ts"

export const tracker = new Hono<{ Variables: AuthVariables }>()
interface Truck {
  id: string; band_id: string; name: string; public_live: boolean; share_id: string | null
  status: "live" | "delayed"; message: string; meetup_lat: number; meetup_lng: number; meetup_label: string
}
async function getTruck(slug: string): Promise<Truck> {
  const rows = await sql<Truck[]>`SELECT t.* FROM trucks t JOIN bands b ON b.id = t.band_id WHERE b.slug = ${slug}`
  const truck = rows[0]
  if (!truck) throw new HTTPException(404, { message: "Truck not found." })
  if (!await isLive(truck.band_id, "truck_tracker")) throw new HTTPException(403, { message: "Tracking is not available for this band." })
  return truck
}
tracker.get("/public/bands/:slug/tracker", async c => {
  const truck = await getTruck(c.req.param("slug"))
  const positions = truck.public_live ? await sql<Position[]>`SELECT DISTINCT ON (source) lat, lng, heading, accuracy_m, source, recorded_at
    FROM positions WHERE truck_id = ${truck.id}::uuid AND share_id = ${truck.share_id}::uuid
    AND recorded_at > now() - interval '24 hours' ORDER BY source, recorded_at DESC` : []
  const position = pickPosition(positions)
  // Recheck the live generation after reading positions to avoid exposing a
  // previous share if end-live or a new sharing session raced this request.
  const current = await sql<{ public_live: boolean; share_id: string | null }[]>`SELECT public_live, share_id FROM trucks WHERE id = ${truck.id}::uuid`
  const live = truck.public_live && current[0]?.public_live && current[0].share_id === truck.share_id
  const visible = live ? position : null
  return c.json({ truck: {
    name: truck.name, publicLive: Boolean(live),
    status: !live ? "not-live" : !visible || Date.now() - +new Date(visible.recorded_at) > 30000 ? "signal-lost" : truck.status,
    message: live ? truck.message : "Not on the road yet",
    meetup: { lat: truck.meetup_lat, lng: truck.meetup_lng, label: truck.meetup_label },
    position: visible ? { lat: visible.lat, lng: visible.lng, accuracy: visible.accuracy_m,
      source: visible.source, recordedAt: new Date(visible.recorded_at).toISOString() } : null,
    serverTime: new Date().toISOString()
  } })
})
tracker.get("/admin/bands/:slug/tracker", async c => {
  const actor = await requireUser(c)
  if (actor instanceof Response) return actor
  const truck = await getTruck(c.req.param("slug"))
  if (!isOrganizerFor(actor, truck.band_id)) throw new HTTPException(403, { message: "This band's crew only." })
  return c.json({ publicLive: truck.public_live, shareId: truck.share_id })
})
tracker.post("/admin/bands/:slug/tracker/:action", async c => {
  const actor = await requireUser(c)
  if (actor instanceof Response) return actor
  const truck = await getTruck(c.req.param("slug"))
  if (!isOrganizerFor(actor, truck.band_id)) throw new HTTPException(403, { message: "This band's crew only." })
  const action = c.req.param("action")
  const data = await body(c)
  if (action === "go-live") {
    const rows = await sql<{ share_id: string }[]>`UPDATE trucks SET public_live = true, live_since = now(), share_id = gen_random_uuid(), status = 'live', message = '' WHERE id = ${truck.id}::uuid RETURNING share_id`
    return c.json({ shareId: rows[0]!.share_id })
  }
  if (action === "end-live") {
    await sql.begin(async tx => {
      await tx`UPDATE trucks SET public_live = false, share_id = NULL, message = '' WHERE id = ${truck.id}::uuid`
      await tx`DELETE FROM positions WHERE truck_id = ${truck.id}::uuid`
    })
    return c.json({ ok: true })
  }
  if (action === "delayed") {
    const message = string(data.message, "Update", 1, 240).trim()
    if (!message) throw new HTTPException(400, { message: "Add a short update." })
    await sql`UPDATE trucks SET status = 'delayed', message = ${message} WHERE id = ${truck.id}::uuid`
    return c.json({ ok: true })
  }
  if (action !== "position") throw new HTTPException(404, { message: "Unknown tracker action." })
  if (!validPosition(data)) throw new HTTPException(400, { message: "Location is not accurate enough. Enable Precise Location and try outside." })
  const shareId = uuid(data.shareId)
  await sql.begin(async tx => {
    const rows = await tx<{ id: string }[]>`SELECT id FROM trucks WHERE id = ${truck.id}::uuid AND public_live AND share_id = ${shareId}::uuid FOR UPDATE`
    if (!rows[0]) throw new HTTPException(409, { message: "Sharing ended or another crew member started a new session. Go live again." })
    const recent = await tx`SELECT id FROM positions WHERE truck_id = ${truck.id}::uuid AND share_id = ${shareId}::uuid AND recorded_at > now() - interval '3 seconds' LIMIT 1`
    if (recent.length) throw new HTTPException(429, { message: "Position received recently. Wait a few seconds." })
    await tx`INSERT INTO positions (truck_id, share_id, lat, lng, accuracy_m, heading, source, user_id)
      VALUES (${truck.id}::uuid, ${shareId}::uuid, ${data.lat as number}, ${data.lng as number}, ${data.accuracy as number}, ${data.heading as number ?? null}, 'phone_fallback', ${actor.id}::uuid)`
    await tx`DELETE FROM positions WHERE truck_id = ${truck.id}::uuid AND recorded_at < now() - interval '24 hours'`
  })
  return c.json({ ok: true })
})
tracker.get("/public/bands/:slug/content/:module", async c => {
  const module = c.req.param("module")
  if (module !== "guide" && module !== "updates") throw new HTTPException(404)
  const rows = await sql<{ band_id: string; updates: unknown; guide: unknown; updated_at: Date }[]>`SELECT bc.* FROM band_content bc JOIN bands b ON b.id = bc.band_id WHERE b.slug = ${c.req.param("slug")}`
  const row = rows[0]
  if (!row) throw new HTTPException(404, { message: "Event information is not available yet." })
  if (!await isLive(row.band_id, module)) throw new HTTPException(403, { message: "This feature is not available." })
  return c.json({ content: row[module], updatedAt: row.updated_at.toISOString() })
})
