import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { bodyLimit } from "hono/body-limit"

import { sql } from "../../db.ts"
import { requireUser, type AuthVariables } from "../../auth/routes.ts"
import { randomToken, sha256 } from "../../auth/passwords.ts"
import { rateLimit } from "../../auth/rate-limit.ts"
import { isLive } from "../../entitlements/index.ts"
import { body, uuid } from "../../validation.ts"
import { isBlockedBetween } from "./access.ts"
import {
  ABANDON_MS,
  MAX_BATCH_POINTS,
  fixFreshness,
  sanitizePoint,
  type Fix,
  type Freshness,
  type MotionState,
  type PositionSource,
} from "./geo.ts"

export const friends = new Hono<{ Variables: AuthVariables }>()

/** A sharing session can never outlive the event, and never runs past this. */
const MAX_SHARE_HOURS = 12
/** Invite links are short-lived on purpose; a carnival connection is ephemeral. */
const INVITE_HOURS = 48
/** An enrolled device is useful for one event cycle, not indefinitely. */
const MAX_DEVICE_DAYS = 90
/** Bounds token accumulation per person per band. */
const MAX_DEVICES_PER_BAND = 5

interface BandRow {
  id: string
  slug: string
  name: string
  ends_at: Date | null
}

/**
 * Resolve a band and confirm it is entitled to friend sharing, in one query.
 *
 * Entitlement used to be a second round trip through `isLive`. On a deployed
 * stack a round trip costs roughly 150ms, so folding the check into the band
 * lookup removes a sixth of the read path's latency for no extra risk: the
 * entitlement rules are the same ones `entitledModules` applies (active, in
 * window), just expressed as an EXISTS alongside the band row.
 */
async function requireBand(slug: string): Promise<BandRow> {
  const rows = await sql<BandRow[]>`
    SELECT b.id, b.slug, b.name, b.ends_at
    FROM bands b
    WHERE b.slug = ${slug}
      AND EXISTS (
        SELECT 1 FROM band_entitlements e
        WHERE e.band_id = b.id AND e.module_code = 'friends' AND e.status = 'active'
          AND e.starts_at <= now() AND (e.ends_at IS NULL OR e.ends_at > now())
      )
  `
  const band = rows[0]
  if (!band) {
    // Distinguish "no such band" from "not entitled" with one cheap follow-up,
    // so the message stays honest without costing a round trip on the happy path.
    const exists = await sql<{ id: string }[]>`SELECT id FROM bands WHERE slug = ${slug} LIMIT 1`
    if (!exists[0]) throw new HTTPException(404, { message: "That band is not on Truck Tracker." })
    throw new HTTPException(403, { message: "Friend sharing is not available for this band." })
  }
  return band
}

/**
 * When a sharing session started now should end.
 *
 * Returns null when the event is already over, which is the caller's signal to
 * refuse. Capped so a mis-set event window cannot produce an open-ended session.
 */
function shareWindow(band: BandRow, now = new Date()): Date | null {
  const cap = new Date(now.getTime() + MAX_SHARE_HOURS * 3_600_000)
  if (!band.ends_at) return cap
  const eventEnd = new Date(band.ends_at)
  if (eventEnd <= now) return null
  return eventEnd < cap ? eventEnd : cap
}

/**
 * When a device enrolled now should stop working.
 *
 * Bounded by the event, so a token cannot outlive the event it was issued for,
 * and capped even when the event window is open-ended. Returns null when the
 * event is already over.
 */
function deviceWindow(band: BandRow, now = new Date()): Date | null {
  const cap = new Date(now.getTime() + MAX_DEVICE_DAYS * 86_400_000)
  if (!band.ends_at) return cap
  const eventEnd = new Date(band.ends_at)
  if (eventEnd <= now) return null
  return eventEnd < cap ? eventEnd : cap
}

interface SessionRow {
  id: string
  ends_at: Date
}

async function openSession(userId: string, bandId: string): Promise<SessionRow | null> {
  const rows = await sql<SessionRow[]>`
    SELECT id, ends_at FROM share_sessions
    WHERE user_id = ${userId}::uuid AND band_id = ${bandId}::uuid
      AND ended_at IS NULL AND revoked_at IS NULL AND ends_at > now()
    LIMIT 1
  `
  return rows[0] ?? null
}

/**
 * Start (or resume) sharing for this person in this band.
 *
 * Idempotent: an already-open session is returned rather than replaced, because
 * the unique index permits only one and a second device must not steal it.
 */
async function startSharing(userId: string, band: BandRow): Promise<SessionRow> {
  const existing = await openSession(userId, band.id)
  if (existing) return existing
  const endsAt = shareWindow(band)
  if (!endsAt) throw new HTTPException(409, { message: "This event has ended, so sharing cannot start." })
  const rows = await sql<SessionRow[]>`
    INSERT INTO share_sessions (user_id, band_id, ends_at)
    VALUES (${userId}::uuid, ${band.id}::uuid, ${endsAt.toISOString()})
    RETURNING id, ends_at
  `
  return rows[0]!
}

/** Stop sharing and remove the stored position for every friend immediately. */
async function stopSharing(userId: string, bandId: string): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`
      UPDATE share_sessions SET ended_at = now()
      WHERE user_id = ${userId}::uuid AND band_id = ${bandId}::uuid
        AND ended_at IS NULL AND revoked_at IS NULL
    `
    // Latest-only storage means one row to clear. Deleting it here, rather than
    // relying on a freshness window, is what makes "stop" take effect at once.
    await tx`DELETE FROM friend_positions WHERE user_id = ${userId}::uuid AND band_id = ${bandId}::uuid`
  })
}

interface PositionRow extends Fix {
  user_id: string
  name: string
  session_id: string
}
/**
 * Positions this person is allowed to see right now: accepted friends only,
 * open unexpired sessions only, and never their own.
 *
 * The `JOIN connections ... status = 'accepted'` on both pair directions *is*
 * the authorization rule, expressed once, in the query. Changing who may see a
 * position therefore means changing this join and `maySeePosition` in
 * `access.ts` together. Nothing is re-checked per row: doing so cost one extra
 * query for every friend on every poll, which is the read path a hundred people
 * polling every five seconds actually hits.
 */
async function visibleFriendPositions(actorId: string, bandId: string): Promise<PositionRow[]> {
  return sql<PositionRow[]>`
    SELECT fp.user_id, u.name, fp.session_id, fp.lat, fp.lng, fp.accuracy_m,
           fp.heading, fp.motion_state, fp.source, fp.captured_at
    FROM friend_positions fp
    JOIN users u ON u.id = fp.user_id
    JOIN share_sessions ss ON ss.id = fp.session_id
      AND ss.ended_at IS NULL AND ss.revoked_at IS NULL AND ss.ends_at > now()
    JOIN connections c ON c.band_id = fp.band_id AND c.status = 'accepted'
      AND ((c.requester_id = ${actorId}::uuid AND c.addressee_id = fp.user_id)
        OR (c.addressee_id = ${actorId}::uuid AND c.requester_id = fp.user_id))
    WHERE fp.band_id = ${bandId}::uuid
  `
}

interface FriendView {
  connectionId: string
  userId: string
  name: string
  status: "accepted" | "blocked"
  blockedByMe: boolean
  sharing: boolean
  freshness: Freshness | null
  ageSeconds: number | null
  position: {
    lat: number
    lng: number
    accuracy: number
    heading: number | null
    motionState: MotionState
    source: PositionSource
    capturedAt: string
  } | null
}

function positionPayload(row: PositionRow, now: number): Pick<FriendView, "freshness" | "ageSeconds" | "position"> {
  const freshness = fixFreshness(row, now)
  if (freshness === "abandoned") return { freshness: null, ageSeconds: null, position: null }
  const capturedAt = new Date(row.captured_at)
  return {
    freshness,
    ageSeconds: Math.max(0, Math.floor((now - +capturedAt) / 1000)),
    position: {
      lat: row.lat,
      lng: row.lng,
      accuracy: row.accuracy_m,
      heading: row.heading,
      motionState: row.motion_state,
      source: row.source,
      capturedAt: capturedAt.toISOString(),
    },
  }
}

/** Who I am connected to in this band, plus my own sharing state. */
friends.get("/bands/:slug", async (c) => {
  const actor = await requireUser(c)
  if (actor instanceof Response) return actor
  const band = await requireBand(c.req.param("slug"))

  // Everything below is independent, so it runs concurrently.
  //
  // On the deployed stack a round trip costs roughly 150ms, so running these
  // five sequentially cost about 750ms of wall time on every poll — the single
  // largest cost in the read path. The pool allows ten connections, so issuing
  // them together turns that into roughly one round trip.
  const [session, connectionRows, positions, invites, deviceRows] = await Promise.all([
    openSession(actor.id, band.id),
    sql<{
      id: string
      status: "accepted" | "blocked"
      blocked_by: string | null
      friend_id: string
      name: string
    }[]>`
      SELECT c.id, c.status, c.blocked_by,
             CASE WHEN c.requester_id = ${actor.id}::uuid THEN c.addressee_id ELSE c.requester_id END AS friend_id,
             u.name
      FROM connections c
      JOIN users u ON u.id = CASE WHEN c.requester_id = ${actor.id}::uuid THEN c.addressee_id ELSE c.requester_id END
      WHERE c.band_id = ${band.id}::uuid
        AND (c.requester_id = ${actor.id}::uuid OR c.addressee_id = ${actor.id}::uuid)
        AND c.status <> 'removed'
      ORDER BY c.created_at DESC
    `,
    visibleFriendPositions(actor.id, band.id),
    sql<{ id: string; expires_at: Date }[]>`
      SELECT id, expires_at FROM friend_invites
      WHERE inviter_id = ${actor.id}::uuid AND band_id = ${band.id}::uuid
        AND revoked_at IS NULL AND accepted_at IS NULL AND expires_at > now()
      ORDER BY created_at DESC
    `,
    sql<{ id: string; platform: string; app_version: string | null; expires_at: Date; last_seen_at: Date | null }[]>`
      SELECT id, platform, app_version, expires_at, last_seen_at FROM devices
      WHERE user_id = ${actor.id}::uuid AND band_id = ${band.id}::uuid
        AND active AND revoked_at IS NULL AND expires_at > now()
      ORDER BY created_at DESC
    `,
  ])
  const now = Date.now()

  const byUser = new Map(positions.map((row) => [row.user_id, row]))

  const friendViews: FriendView[] = connectionRows.map((row) => {    const found = byUser.get(row.friend_id)
    const presenting = found ? positionPayload(found, now) : null
    return {
      connectionId: row.id,
      userId: row.friend_id,
      name: row.name,
      status: row.status,
      blockedByMe: row.blocked_by === actor.id,
      sharing: Boolean(found),
      freshness: presenting?.freshness ?? null,
      ageSeconds: presenting?.ageSeconds ?? null,
      position: presenting?.position ?? null,
    }
  })

  return c.json({
    sharing: {
      active: Boolean(session),
      sessionId: session?.id ?? null,
      endsAt: session ? new Date(session.ends_at).toISOString() : null,
      maxHours: MAX_SHARE_HOURS,
    },
    invites: invites.map((row) => ({ id: row.id, expiresAt: new Date(row.expires_at).toISOString() })),
    devices: deviceRows.map((row) => ({
      id: row.id,
      platform: row.platform,
      appVersion: row.app_version,
      expiresAt: new Date(row.expires_at).toISOString(),
      lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at).toISOString() : null,
    })),
    maxDevices: MAX_DEVICES_PER_BAND,
    friends: friendViews,
    serverTime: new Date().toISOString(),
  })
})

/** The map read. Same visibility rules, coordinates only. */
friends.get("/bands/:slug/positions", async (c) => {
  const actor = await requireUser(c)
  if (actor instanceof Response) return actor
  const band = await requireBand(c.req.param("slug"))
  const now = Date.now()
  const rows = await visibleFriendPositions(actor.id, band.id)
  return c.json({
    positions: rows
      .map((row) => {
        const presenting = positionPayload(row, now)
        if (!presenting.position) return null
        return { userId: row.user_id, name: row.name, ...presenting }
      })
      .filter((row) => row !== null),
    serverTime: new Date().toISOString(),
  })
})

/** Create an invite link or QR payload. The token is returned once, never stored raw. */
friends.post("/bands/:slug/invites", async (c) => {
  const actor = await requireUser(c)
  if (actor instanceof Response) return actor
  const band = await requireBand(c.req.param("slug"))
  await rateLimit(c, "friend-invite", actor.id, 20)

  const token = randomToken()
  const expiresAt = new Date(Date.now() + INVITE_HOURS * 3_600_000)
  const capped = band.ends_at && new Date(band.ends_at) < expiresAt ? new Date(band.ends_at) : expiresAt
  if (capped <= new Date()) {
    throw new HTTPException(409, { message: "This event has ended, so invites cannot be created." })
  }

  const rows = await sql<{ id: string }[]>`
    INSERT INTO friend_invites (band_id, inviter_id, token_hash, expires_at)
    VALUES (${band.id}::uuid, ${actor.id}::uuid, ${sha256(token)}, ${capped.toISOString()})
    RETURNING id
  `

  const origin = c.get("env").frontendOrigin
  return c.json({
    invite: {
      id: rows[0]!.id,
      token,
      url: `${origin}/${band.slug}/friends?invite=${token}`,
      expiresAt: capped.toISOString(),
    },
  })
})

friends.delete("/bands/:slug/invites/:id", async (c) => {
  const actor = await requireUser(c)
  if (actor instanceof Response) return actor
  const band = await requireBand(c.req.param("slug"))
  const id = uuid(c.req.param("id"))
  const rows = await sql<{ id: string }[]>`
    UPDATE friend_invites SET revoked_at = now()
    WHERE id = ${id}::uuid AND band_id = ${band.id}::uuid AND inviter_id = ${actor.id}::uuid
      AND revoked_at IS NULL AND accepted_at IS NULL
    RETURNING id
  `
  // Report the miss rather than pretending to revoke: an id that belongs to
  // someone else, or to another band, must not look like a successful action.
  if (!rows[0]) throw new HTTPException(404, { message: "That invite is not open." })
  return c.json({ ok: true })
})

/** Accept an invite. This is the accepter's explicit consent, so it connects immediately. */
friends.post("/invites/:token/accept", async (c) => {
  const actor = await requireUser(c)
  if (actor instanceof Response) return actor
  // A truncated or garbled link is a normal thing for a person to hit, so it
  // gets a human answer rather than the length rule that caught it.
  const raw = c.req.param("token") ?? ""
  if (!/^[0-9a-f]{64}$/i.test(raw)) {
    throw new HTTPException(400, { message: "That invite link looks incomplete. Ask your friend to send it again." })
  }
  const token = raw
  await rateLimit(c, "friend-accept", actor.id, 40)

  // Read the invite first, outside the transaction. The entitlement and block
  // checks below read through the pooled client, and calling one of those from
  // inside `sql.begin` needs a second connection while the transaction holds
  // one — the deadlock documented on `writePoints`. The transaction re-reads
  // the invite with FOR UPDATE, so single use is still enforced under lock.
  const preview = await sql<{ band_id: string; inviter_id: string }[]>`
    SELECT band_id, inviter_id FROM friend_invites
    WHERE token_hash = ${sha256(token)}
      AND revoked_at IS NULL AND accepted_at IS NULL AND expires_at > now()
  `
  const peeked = preview[0]
  if (!peeked) throw new HTTPException(400, { message: "That invite has expired or has already been used." })
  if (peeked.inviter_id === actor.id) throw new HTTPException(400, { message: "That is your own invite link." })
  if (!await isLive(peeked.band_id, "friends")) {
    throw new HTTPException(403, { message: "Friend sharing is not available for this band." })
  }
  if (await isBlockedBetween(peeked.band_id, peeked.inviter_id, actor.id)) {
    throw new HTTPException(403, { message: "You cannot connect with this person." })
  }

  const connection = await sql.begin(async (tx) => {
    const invites = await tx<{ id: string; band_id: string; inviter_id: string }[]>`
      SELECT id, band_id, inviter_id FROM friend_invites
      WHERE token_hash = ${sha256(token)}
        AND revoked_at IS NULL AND accepted_at IS NULL AND expires_at > now()
      FOR UPDATE
    `
    // Re-checked under lock: two people can open the same link at once, and
    // only the first acceptance may count.
    const invite = invites[0]
    if (!invite) throw new HTTPException(400, { message: "That invite has expired or has already been used." })

    // One row per pair, so a re-accept after a removal reactivates rather than
    // conflicting with the pair index.
    const rows = await tx<{ id: string; status: string }[]>`
      INSERT INTO connections (band_id, requester_id, addressee_id, status, responded_at)
      VALUES (${invite.band_id}::uuid, ${invite.inviter_id}::uuid, ${actor.id}::uuid, 'accepted', now())
      ON CONFLICT (band_id, LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id))
        DO UPDATE SET status = 'accepted', blocked_by = NULL, responded_at = now()
      RETURNING id, status
    `
    await tx`UPDATE friend_invites SET accepted_by = ${actor.id}::uuid, accepted_at = now() WHERE id = ${invite.id}::uuid`
    return { connectionId: rows[0]!.id }
  })

  return c.json({ ok: true, connectionId: connection.connectionId })
})

/** Remove a friend. Symmetric: either side can end it. */
friends.delete("/bands/:slug/connections/:id", async (c) => {
  const actor = await requireUser(c)
  if (actor instanceof Response) return actor
  const band = await requireBand(c.req.param("slug"))
  const id = uuid(c.req.param("id"))
  await sql`
    UPDATE connections SET status = 'removed', responded_at = now()
    WHERE id = ${id}::uuid AND band_id = ${band.id}::uuid
      AND (requester_id = ${actor.id}::uuid OR addressee_id = ${actor.id}::uuid)
      AND status <> 'blocked'
  `
  // Removing a friend must stop the sharing that was visible to them.
  await stopSharing(actor.id, band.id)
  return c.json({ ok: true })
})

/** Block someone. Permanent for this pair, and neither side can reconnect. */
friends.post("/bands/:slug/connections/:id/block", async (c) => {
  const actor = await requireUser(c)
  if (actor instanceof Response) return actor
  const band = await requireBand(c.req.param("slug"))
  const id = uuid(c.req.param("id"))

  await sql.begin(async (tx) => {
    const rows = await tx<{ id: string }[]>`
      UPDATE connections SET status = 'blocked', blocked_by = ${actor.id}::uuid, responded_at = now()
      WHERE id = ${id}::uuid AND band_id = ${band.id}::uuid
        AND (requester_id = ${actor.id}::uuid OR addressee_id = ${actor.id}::uuid)
      RETURNING id
    `
    if (!rows[0]) throw new HTTPException(404, { message: "That connection is not yours." })
    await tx`
      UPDATE share_sessions SET revoked_at = now()
      WHERE user_id = ${actor.id}::uuid AND band_id = ${band.id}::uuid
        AND ended_at IS NULL AND revoked_at IS NULL
    `
    await tx`DELETE FROM friend_positions WHERE user_id = ${actor.id}::uuid AND band_id = ${band.id}::uuid`
    await tx`
      UPDATE friend_invites SET revoked_at = now()
      WHERE band_id = ${band.id}::uuid AND inviter_id = ${actor.id}::uuid
        AND revoked_at IS NULL AND accepted_at IS NULL
    `
  })
  return c.json({ ok: true })
})

friends.post("/bands/:slug/sharing", async (c) => {
  const actor = await requireUser(c)
  if (actor instanceof Response) return actor
  const band = await requireBand(c.req.param("slug"))
  const session = await startSharing(actor.id, band)
  return c.json({ sharing: { active: true, sessionId: session.id, endsAt: new Date(session.ends_at).toISOString() } })
})

friends.delete("/bands/:slug/sharing", async (c) => {
  const actor = await requireUser(c)
  if (actor instanceof Response) return actor
  const band = await requireBand(c.req.param("slug"))
  await stopSharing(actor.id, band.id)
  return c.json({ ok: true })
})

/**
 * Register a native install for one band's event.
 *
 * The token is shown once and stored hashed. It is scoped to this band and
 * expires with the event, so it cannot be replayed into another band or reused
 * after the event has finished.
 */
friends.post("/bands/:slug/devices", async (c) => {
  const actor = await requireUser(c)
  if (actor instanceof Response) return actor
  const band = await requireBand(c.req.param("slug"))
  const data = await body(c)
  const platform = data.platform === "ios" || data.platform === "android" ? data.platform : null
  if (!platform) throw new HTTPException(400, { message: "Platform must be ios or android." })

  const expiresAt = deviceWindow(band)
  if (!expiresAt) throw new HTTPException(409, { message: "This event has ended, so this device cannot be enrolled." })

  const token = randomToken()
  const rows = await sql.begin(async (tx) => {
    const active = await tx<{ n: number }[]>`
      SELECT count(*)::int AS n FROM devices
      WHERE user_id = ${actor.id}::uuid AND band_id = ${band.id}::uuid
        AND active AND revoked_at IS NULL AND expires_at > now()
    `
    if ((active[0]?.n ?? 0) >= MAX_DEVICES_PER_BAND) {
      throw new HTTPException(409, { message: "Too many devices are enrolled for this event. Remove one and try again." })
    }
    return tx<{ id: string }[]>`
      INSERT INTO devices (user_id, band_id, token_hash, platform, app_version, push_token, expires_at)
      VALUES (${actor.id}::uuid, ${band.id}::uuid, ${sha256(token)}, ${platform},
              ${typeof data.appVersion === "string" ? data.appVersion.slice(0, 40) : null},
              ${typeof data.pushToken === "string" ? data.pushToken.slice(0, 400) : null},
              ${expiresAt.toISOString()})
      RETURNING id
    `
  })
  return c.json({ device: { id: rows[0]!.id, token, platform, expiresAt: expiresAt.toISOString() } })
})

friends.delete("/bands/:slug/devices/:id", async (c) => {
  const actor = await requireUser(c)
  if (actor instanceof Response) return actor
  const band = await requireBand(c.req.param("slug"))
  const id = uuid(c.req.param("id"))
  const rows = await sql<{ id: string }[]>`
    UPDATE devices SET active = false, revoked_at = now()
    WHERE id = ${id}::uuid AND user_id = ${actor.id}::uuid AND band_id = ${band.id}::uuid
      AND revoked_at IS NULL
    RETURNING id
  `
  if (!rows[0]) throw new HTTPException(404, { message: "That device is not enrolled for this band." })
  return c.json({ ok: true })
})

interface DeviceRow {
  id: string
  user_id: string
  band_id: string
}

/** Enrolled devices for one person in one band, so the app can show and revoke them. */
friends.get("/bands/:slug/devices", async (c) => {
  const actor = await requireUser(c)
  if (actor instanceof Response) return actor
  const band = await requireBand(c.req.param("slug"))
  const rows = await sql<{ id: string; platform: string; app_version: string | null; expires_at: Date; last_seen_at: Date | null }[]>`
    SELECT id, platform, app_version, expires_at, last_seen_at FROM devices
    WHERE user_id = ${actor.id}::uuid AND band_id = ${band.id}::uuid
      AND active AND revoked_at IS NULL AND expires_at > now()
    ORDER BY created_at DESC
  `
  return c.json({
    devices: rows.map((row) => ({
      id: row.id,
      platform: row.platform,
      appVersion: row.app_version,
      expiresAt: new Date(row.expires_at).toISOString(),
      lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at).toISOString() : null,
    })),
    maxDevices: MAX_DEVICES_PER_BAND,
  })
})

interface WriteOutcome {
  /** False when there is no open session for this band, so no point could land. */
  sessionValid: boolean
  accepted: number
  discarded: number
}

/**
 * The one place a shared position is written.
 *
 * Both writers funnel through here so the browser today and the native app
 * tomorrow cannot drift apart on the rules that matter: the session must be
 * open and unexpired for this band, the band must still be entitled, the write
 * is monotonic on `captured_at` so a replay cannot overwrite a newer fix, and
 * only the latest position is kept.
 *
 * `deviceBandId` is supplied by the native route so a token issued for one
 * event cannot post into another band's session.
 */
async function writePoints(options: {
  userId: string
  bandId: string
  sessionId: string
  source: PositionSource
  rawPoints: unknown[]
  deviceId?: string
  deviceBandId?: string
}): Promise<WriteOutcome> {
  const { userId, bandId, sessionId, source, rawPoints } = options
  const outcome: WriteOutcome = { sessionValid: false, accepted: 0, discarded: rawPoints.length }

  // Entitlement is checked BEFORE the transaction opens, deliberately.
  //
  // `isLive` reads through the pooled client. Called from inside `sql.begin`,
  // that needs a second connection while the transaction is already holding
  // one, so enough concurrent writers exhaust the pool: every transaction waits
  // for a connection that only it can release. Ten simultaneous writes used to
  // wedge the whole API permanently. Never call a pooled-client helper from
  // inside a transaction.
  if (!await isLive(bandId, "friends")) return outcome

  await sql.begin(async (tx) => {
    // Lock the session row so a replay cannot land after a stop.
    const sessions = await tx<{ id: string; band_id: string }[]>`
      SELECT id, band_id FROM share_sessions
      WHERE id = ${sessionId || null}::uuid AND user_id = ${userId}::uuid
        AND ended_at IS NULL AND revoked_at IS NULL AND ends_at > now()
      FOR UPDATE
    `
    const session = sessions[0]
    if (!session) return
    if (session.band_id !== bandId) return
    if (options.deviceBandId && options.deviceBandId !== session.band_id) return
    outcome.sessionValid = true

    const now = Date.now()
    for (const raw of rawPoints) {
      const result = sanitizePoint(raw, now, source)
      if (!result.ok) continue
      const point = result.point
      const written = await tx<{ user_id: string }[]>`
        INSERT INTO friend_positions (user_id, band_id, session_id, lat, lng, accuracy_m, heading, motion_state, source, captured_at, location_uuid)
        VALUES (${userId}::uuid, ${session.band_id}::uuid, ${session.id}::uuid,
                ${point.lat}, ${point.lng}, ${point.accuracy}, ${point.heading}, ${point.motion}, ${source},
                ${point.capturedAt}, ${point.locationUuid})
        ON CONFLICT (user_id, band_id) DO UPDATE SET
          session_id = EXCLUDED.session_id,
          lat = EXCLUDED.lat,
          lng = EXCLUDED.lng,
          accuracy_m = EXCLUDED.accuracy_m,
          heading = EXCLUDED.heading,
          motion_state = EXCLUDED.motion_state,
          source = EXCLUDED.source,
          captured_at = EXCLUDED.captured_at,
          received_at = now(),
          location_uuid = EXCLUDED.location_uuid
        WHERE friend_positions.captured_at < EXCLUDED.captured_at
        RETURNING user_id
      `
      if (written.length) outcome.accepted++
    }
    outcome.discarded = rawPoints.length - outcome.accepted
    if (options.deviceId) {
      await tx`UPDATE devices SET last_seen_at = now() WHERE id = ${options.deviceId}::uuid`
    }
  })

  return outcome
}

/**
 * Native batch ingest.
 *
 * Authenticated by device bearer token rather than the browser session cookie,
 * and deliberately exempt from the origin check in `server/index.ts`, which a
 * native HTTP client cannot satisfy. That exemption is safe only because this
 * route verifies a hashed, revocable token.
 *
 * Always answers 2xx with counts. The SDK retries any non-2xx, so returning an
 * error for a point we have deliberately discarded would create a retry storm
 * that grows the queue instead of clearing it.
 */
friends.post("/positions", bodyLimit({ maxSize: 128 * 1024 }), async (c) => {
  const header = c.req.header("authorization") ?? ""
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : ""
  if (!token) return c.json({ error: { code: "unauthenticated", message: "Device token required." } }, 401)

  const devices = await sql<DeviceRow[]>`
    SELECT id, user_id, band_id FROM devices
    WHERE token_hash = ${sha256(token)}
      AND active AND revoked_at IS NULL AND expires_at > now()
    LIMIT 1
  `
  const device = devices[0]
  if (!device) return c.json({ error: { code: "unauthenticated", message: "Device token is not valid." } }, 401)

  const data = await body(c)
  const rawPoints = Array.isArray(data.points) ? data.points.slice(0, MAX_BATCH_POINTS) : []
  const sessionId = typeof data.sessionId === "string" ? data.sessionId : ""

  const outcome = await writePoints({
    userId: device.user_id,
    bandId: device.band_id,
    sessionId,
    source: "native",
    rawPoints,
    deviceId: device.id,
    deviceBandId: device.band_id,
  })

  return c.json({ accepted: outcome.accepted, discarded: outcome.discarded, retainedForMs: ABANDON_MS })
})

/**
 * Browser ingest, for the web app sharing from a phone.
 *
 * Same pipeline as the native route but authenticated the ordinary way: session
 * cookie plus the origin guard. That is the whole difference between the two
 * writers, which is what makes the native app an addition rather than a
 * rewrite when it arrives.
 *
 * Unlike the native route this returns real errors, because our own client
 * reads them and can recover: a missing session means sharing ended, so the
 * loop should stop and say so rather than retry.
 */
friends.post("/bands/:slug/positions", async (c) => {
  const actor = await requireUser(c)
  if (actor instanceof Response) return actor
  const band = await requireBand(c.req.param("slug"))
  const data = await body(c)
  const rawPoints = Array.isArray(data.points) ? data.points.slice(0, MAX_BATCH_POINTS) : []
  const sessionId = typeof data.sessionId === "string" ? data.sessionId : ""

  const outcome = await writePoints({
    userId: actor.id,
    bandId: band.id,
    sessionId,
    source: "browser",
    rawPoints,
  })

  if (!outcome.sessionValid) {
    throw new HTTPException(409, { message: "Sharing has ended. Start sharing again to be visible." })
  }
  return c.json({ accepted: outcome.accepted, discarded: outcome.discarded })
})
