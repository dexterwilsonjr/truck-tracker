import { before, after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID, randomBytes } from "node:crypto"
import { pickPosition, validPosition } from "../server/modules/truck_tracker/snapshot.ts"
import { fixFreshness, sanitizePoint } from "../server/modules/friends/geo.ts"
process.env.NODE_ENV = "test"
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://truck:local-test-only@127.0.0.1:55432/truck_tracker_test"
process.env.FRONTEND_ORIGIN = "http://localhost:5173"
const database = new URL(process.env.DATABASE_URL)
if (!['127.0.0.1', 'localhost'].includes(database.hostname) || !database.pathname.endsWith('_test')) throw new Error("Tests require a dedicated localhost *_test database")
const { sql, migrate } = await import("../server/db.ts")
const { app } = await import("../server/index.ts")
const { hashPassword, sha256 } = await import("../server/auth/passwords.ts")
const { rateLimit } = await import("../server/auth/rate-limit.ts")
const { sweepFriendIngestRows } = await import("../server/modules/friends/privacy.ts")
const band = randomUUID(), otherBand = randomUUID(), organizer = randomUUID(), marshal = randomUUID(), outsider = randomUUID(), platform = randomUUID()
const password = "Test-password-unique-12"
let organizerCookie = "", marshalCookie = "", platformCookie = "", outsiderCookie = ""
async function request(path: string, method = "GET", data?: unknown, cookie = "") {
  return app.request(`/api${path}`, { method, headers: { Origin: "http://localhost:5173", "Content-Type": "application/json", Cookie: cookie }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) })
}
async function login(email: string, secret = password) {
  const res = await request("/auth/login", "POST", { email, password: secret })
  assert.equal(res.status, 200, await res.clone().text())
  return res.headers.get("set-cookie")!.split(",").at(-1)!.trim().split(";")[0]!
}
before(async () => {
  await migrate()
  await sql`TRUNCATE bands, users, rate_limits CASCADE`
  await sql`INSERT INTO bands (id, slug, name) VALUES (${band}, 'test-band', 'Test'), (${otherBand}, 'other-band', 'Other')`
  const hash = await hashPassword(password)
  for (const [id, email, role] of [[organizer, 'organizer@example.test', 'patron'], [marshal, 'marshal@example.test', 'patron'], [outsider, 'outsider@example.test', 'patron'], [platform, 'platform@example.test', 'platform_admin']]) {
    await sql`INSERT INTO users(id, email, password_hash, platform_role) VALUES (${id!}, ${email!}, ${hash}, ${role!})`
  }
  await sql`INSERT INTO band_members(band_id,user_id,role) VALUES (${band},${organizer},'organizer'), (${band},${marshal},'marshal'), (${otherBand},${outsider},'marshal')`
  await sql`INSERT INTO band_entitlements(band_id,module_code) VALUES (${band}, 'truck_tracker'), (${otherBand}, 'truck_tracker')`
  await sql`INSERT INTO trucks(band_id) VALUES (${band}), (${otherBand})`
  organizerCookie = await login('organizer@example.test')
  marshalCookie = await login('marshal@example.test')
  platformCookie = await login('platform@example.test')
  outsiderCookie = await login('outsider@example.test')
})
after(async () => { await sql.end({ timeout: 5 }) })

test('organizer cannot reset outsiders, platform admins or peer organizers', async () => {
  for (const target of [outsider, platform, organizer]) {
    const res = await request(`/admin/users/${target}/password`, 'POST', { bandId: band }, organizerCookie)
    assert.equal(res.status, 403)
  }
  assert.equal((await request(`/admin/users/${outsider}/password`, 'POST', { bandId: otherBand }, organizerCookie)).status, 403)
})
test('temporary reset revokes sessions and enforces change on server', async () => {
  const reset = await request(`/admin/users/${marshal}/password`, 'POST', { bandId: band }, organizerCookie)
  assert.equal(reset.status, 200)
  const temporary = (await reset.json()).temporaryPassword
  assert.equal((await request(`/admin/bands/test-band/tracker`, 'GET', undefined, marshalCookie)).status, 401)
  const temporaryCookie = await login('marshal@example.test', temporary)
  assert.equal((await request('/admin/bands/test-band/tracker/go-live', 'POST', {}, temporaryCookie)).status, 403)
  const changed = await request('/auth/change-password', 'POST', { currentPassword: temporary, password }, temporaryCookie)
  assert.equal(changed.status, 200, await changed.clone().text())
  assert.equal((await request('/admin/bands/test-band/tracker', 'GET', undefined, temporaryCookie)).status, 401)
  marshalCookie = await login('marshal@example.test')
})
test('one recovery token allows exactly one concurrent reset, invalidates other tokens and sessions', async () => {
  const token = 'a'.repeat(64), second = 'b'.repeat(64)
  for (const value of [token, second]) await sql`INSERT INTO password_reset_tokens(user_id, token_hash, expires_at) VALUES (${marshal}, ${sha256(value)}, now() + interval '1 hour')`
  const results = await Promise.all([1,2].map(() => request('/auth/reset', 'POST', { token, password })))
  assert.deepEqual(results.map(r => r.status).sort(), [200,400])
  assert.equal((await request('/auth/reset', 'POST', { token: second, password })).status, 400)
  assert.equal((await request('/admin/bands/test-band/tracker', 'GET', undefined, marshalCookie)).status, 401)
  marshalCookie = await login('marshal@example.test')
})
test('tracker isolates bands and hides ended sessions, including late GPS posts', async () => {
  assert.equal((await request('/admin/bands/other-band/tracker/go-live', 'POST', {}, marshalCookie)).status, 403)
  const start = await request('/admin/bands/test-band/tracker/go-live', 'POST', {}, marshalCookie)
  assert.equal(start.status, 200)
  const { shareId } = await start.json()
  const position = { shareId, lat: 11.18, lng: -60.73, accuracy: 10, heading: null }
  assert.equal((await request('/admin/bands/test-band/tracker/position', 'POST', position, marshalCookie)).status, 200)
  const live = await (await request('/public/bands/test-band/tracker')).json()
  assert.equal(live.truck.position.lat, position.lat)
  assert.equal(live.truck.status, 'live')
  assert.equal((await request('/admin/bands/test-band/tracker/delayed', 'POST', { message: 'Water stop' }, marshalCookie)).status, 200)
  assert.equal((await (await request('/public/bands/test-band/tracker')).json()).truck.status, 'delayed')
  await sql`UPDATE positions SET recorded_at = now() - interval '1 minute'`
  assert.equal((await (await request('/public/bands/test-band/tracker')).json()).truck.status, 'signal-lost')
  await request('/admin/bands/test-band/tracker/end-live', 'POST', {}, marshalCookie)
  assert.equal((await (await request('/public/bands/test-band/tracker')).json()).truck.position, null)
  assert.equal((await request('/admin/bands/test-band/tracker/position', 'POST', position, marshalCookie)).status, 409)
  await request('/admin/bands/test-band/tracker/go-live', 'POST', {}, marshalCookie)
  assert.equal((await (await request('/public/bands/test-band/tracker')).json()).truck.position, null)
})
test('future, expired and revoked entitlements do not grant tracker access', async () => {
  for (const change of ['future','expired','revoked']) {
    await sql`UPDATE band_entitlements SET status = 'active', starts_at = now() - interval '1 day', ends_at = null WHERE band_id = ${band}`
    if (change === 'future') await sql`UPDATE band_entitlements SET starts_at = now() + interval '1 day' WHERE band_id = ${band}`
    if (change === 'expired') await sql`UPDATE band_entitlements SET ends_at = now() - interval '1 second' WHERE band_id = ${band}`
    if (change === 'revoked') await sql`UPDATE band_entitlements SET status = 'revoked' WHERE band_id = ${band}`
    assert.equal((await request('/public/bands/test-band/tracker')).status, 403)
  }
  await sql`UPDATE band_entitlements SET status = 'active', starts_at = now() - interval '1 day', ends_at = null WHERE band_id = ${band}`
})
test('malformed inputs fail cleanly and cross-origin writes fail', async () => {
  assert.equal((await request('/auth/login', 'POST', { email: [], password: 4 })).status, 400)
  assert.equal((await request('/auth/register', 'POST', null)).status, 400)
  assert.equal((await app.request('/api/auth/logout', { method: 'POST', headers: { Origin: 'https://elsewhere.test' } })).status, 403)
  assert.equal((await request('/platform/users/not-a-uuid/password', 'POST', {}, platformCookie)).status, 400)
})
test('account limits are stored in PostgreSQL', async () => {
  for (let i = 0; i < 20; i++) assert.equal((await request('/auth/login', 'POST', { email: 'unknown@example.test', password })).status, 401)
  assert.equal((await request('/auth/login', 'POST', { email: 'unknown@example.test', password })).status, 429)
  assert.ok((await sql`SELECT key FROM rate_limits WHERE hits > 20`).length)
})
test('snapshot prefers fresh hardware, then phone, then last known; validates coordinates', () => {
  const now = Date.now()
  const phone = { lat: 11, lng: -60, accuracy_m: 5, heading: null, source: 'phone_fallback' as const, recorded_at: new Date(now - 1000) }
  const box = { ...phone, source: 'fmc920' as const, recorded_at: new Date(now - 2000) }
  assert.equal(pickPosition([phone,box], now)?.source, 'fmc920')
  assert.equal(pickPosition([phone,{ ...box, recorded_at: new Date(now - 31000) }], now)?.source, 'phone_fallback')
  assert.equal(pickPosition([], now), null)
  assert.equal(validPosition({ lat:0, lng:0, accuracy:10 }), false)
  assert.equal(validPosition({ lat:11, lng:-60, accuracy:201 }), false)
  assert.equal(validPosition({ lat:11, lng:-60, accuracy:10 }), true)
})
test('public database role cannot read account or location tables', async () => {
  await sql`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='tracker_test_public') THEN CREATE ROLE tracker_test_public; END IF; END $$`
  await sql`GRANT USAGE ON SCHEMA public TO tracker_test_public`
  await sql`GRANT SELECT ON users, sessions, positions, trucks TO tracker_test_public`
  await sql.begin(async tx => {
    await tx`SET LOCAL ROLE tracker_test_public`
    assert.equal((await tx`SELECT id FROM users`).length, 0)
    assert.equal((await tx`SELECT token_hash FROM sessions`).length, 0)
    assert.equal((await tx`SELECT id FROM trucks`).length, 0)
    assert.equal((await tx`SELECT id FROM positions`).length, 0)
  })
})

// ---------------------------------------------------------------------------
// Friend sharing
//
// The invariant that matters: only an accepted connection, with an open
// unexpired sharing session, ever discloses a coordinate.
// ---------------------------------------------------------------------------

/** A friend fix deliberately far from the truck's coordinates, so a leak is detectable. */
const FRIEND_FIX = { lat: 11.9999, lng: -60.9999, accuracy: 12, heading: 90, motion: 'moving' as const }

/** A point as a device would send it, with a capture time so it can be presented. */
function fixAt(offsetMs = 0, overrides: Record<string, unknown> = {}) {
  return { ...FRIEND_FIX, capturedAt: new Date(Date.now() + offsetMs).toISOString(), ...overrides }
}

async function grantFriends(bandId: string) {
  await sql`INSERT INTO band_entitlements (band_id, module_code, status, starts_at, ends_at)
    VALUES (${bandId}::uuid, 'friends', 'active', now() - interval '1 day', null)
    ON CONFLICT (band_id, module_code) DO UPDATE SET status = 'active', starts_at = now() - interval '1 day', ends_at = null`
}

async function createInvite(cookie: string, slug = 'test-band') {
  const res = await request(`/friends/bands/${slug}/invites`, 'POST', {}, cookie)
  assert.equal(res.status, 200, await res.clone().text())
  return (await res.json()).invite as { id: string; token: string; url: string; expiresAt: string }
}

async function connect(cookie: string, invite: { token: string }) {
  const res = await request(`/friends/invites/${invite.token}/accept`, 'POST', {}, cookie)
  assert.equal(res.status, 200, await res.clone().text())
  return res
}

async function registerDevice(cookie: string, platform = 'ios', slug = 'test-band') {
  const scoped = await request(`/friends/bands/${slug}/devices`, 'POST', { platform }, cookie)
  assert.equal(scoped.status, 200, await scoped.clone().text())
  return (await scoped.json()).device as { id: string; token: string; platform: string; expiresAt: string }
}

/** Posts a batch straight at the native route, with no browser Origin. */
async function postPoints(deviceToken: string, sessionId: string, points: unknown[]) {
  return app.request('/api/friends/positions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deviceToken}` },
    body: JSON.stringify({ sessionId, points }),
  })
}

/** Posts as the web app does: session cookie, normal origin guard. */
async function postBrowserPoints(cookie: string, sessionId: string, points: unknown[], slug = 'test-band') {
  return request(`/friends/bands/${slug}/positions`, 'POST', { sessionId, points }, cookie)
}

/** A point as the browser sends it: no motion, because a browser cannot report it. */
function browserFixAt(offsetMs = 0, overrides: Record<string, unknown> = {}) {
  return { lat: FRIEND_FIX.lat, lng: FRIEND_FIX.lng, accuracy: 12, heading: null, capturedAt: new Date(Date.now() + offsetMs).toISOString(), ...overrides }
}

async function viewOf(cookie: string, slug = 'test-band') {
  const res = await request(`/friends/bands/${slug}`, 'GET', undefined, cookie)
  assert.equal(res.status, 200, await res.clone().text())
  return await res.json() as {
    sharing: { active: boolean; sessionId: string | null; endsAt: string | null }
    invites: { id: string }[]
    friends: { connectionId: string; userId: string; name: string; status: string; sharing: boolean; freshness: string | null; position: { lat: number; lng: number } | null }[]
  }
}

test('friend sharing is off until the band is entitled', async () => {
  await sql`DELETE FROM band_entitlements WHERE band_id = ${band}::uuid AND module_code = 'friends'`
  assert.equal((await request('/friends/bands/test-band', 'GET', undefined, organizerCookie)).status, 403)
  await grantFriends(band)
})

test('invited friends see each other; an unrelated account sees nothing', async () => {
  await grantFriends(band)
  const invite = await createInvite(organizerCookie)
  await connect(marshalCookie, invite)

  const sharing = await request('/friends/bands/test-band/sharing', 'POST', {}, marshalCookie)
  assert.equal(sharing.status, 200)
  const sessionId = (await sharing.json()).sharing.sessionId as string

  const device = await registerDevice(marshalCookie)
  const posted = await postPoints(device.token, sessionId, [fixAt()])
  assert.equal(posted.status, 200)
  assert.equal((await posted.json()).accepted, 1)

  const organizerView = await viewOf(organizerCookie)
  const friend = organizerView.friends.find((f) => f.userId === marshal)
  assert.ok(friend, 'the accepted friend should be listed')
  assert.equal(friend.position?.lat, FRIEND_FIX.lat)
  assert.equal(friend.freshness, 'live')
  assert.equal(friend.sharing, true)

  // The unrelated marshal in the other band is signed in but not connected here.
  const outsiderView = await viewOf(outsiderCookie)
  assert.equal(outsiderView.friends.length, 0)
  const outsiderPositions = await request('/friends/bands/test-band/positions', 'GET', undefined, outsiderCookie)
  assert.deepEqual((await outsiderPositions.json()).positions, [])
})

test('a friend position never reaches the public truck endpoint', async () => {
  const truck = await (await request('/public/bands/test-band/tracker')).json()
  assert.doesNotMatch(JSON.stringify(truck), /11\.9999/)
  assert.equal((await sql`SELECT count(*)::int AS n FROM positions WHERE truck_id = ${band}::uuid`)[0]!.n, 0)
})

test('invites cannot be self-accepted, reused or expired', async () => {
  const invite = await createInvite(organizerCookie)
  assert.equal((await request(`/friends/invites/${invite.token}/accept`, 'POST', {}, organizerCookie)).status, 400)
  await connect(marshalCookie, invite)
  assert.equal((await request(`/friends/invites/${invite.token}/accept`, 'POST', {}, marshalCookie)).status, 400)

  const expiring = await createInvite(organizerCookie)
  await sql`UPDATE friend_invites SET expires_at = now() - interval '1 minute' WHERE id = ${expiring.id}::uuid`
  assert.equal((await request(`/friends/invites/${expiring.token}/accept`, 'POST', {}, outsiderCookie)).status, 400)

  const revoked = await createInvite(organizerCookie)
  assert.equal((await request(`/friends/bands/test-band/invites/${revoked.id}`, 'DELETE', undefined, organizerCookie)).status, 200)
  assert.equal((await request(`/friends/invites/${revoked.token}/accept`, 'POST', {}, outsiderCookie)).status, 400)
})

test('only the inviter can revoke their invite, and only for their band', async () => {
  const invite = await createInvite(organizerCookie)
  // Another signed-in account cannot revoke someone else's invite.
  assert.equal((await request(`/friends/bands/test-band/invites/${invite.id}`, 'DELETE', undefined, marshalCookie)).status, 404)
  assert.ok((await sql`SELECT id FROM friend_invites WHERE id = ${invite.id}::uuid AND revoked_at IS NULL`).length)
  // The inviter can.
  assert.equal((await request(`/friends/bands/test-band/invites/${invite.id}`, 'DELETE', undefined, organizerCookie)).status, 200)
  // Another band cannot reach it, even when that band has the module.
  await grantFriends(otherBand)
  const fresh = await createInvite(organizerCookie)
  assert.equal((await request(`/friends/bands/other-band/invites/${fresh.id}`, 'DELETE', undefined, organizerCookie)).status, 404)
  assert.equal((await request(`/friends/bands/test-band/invites/${fresh.id}`, 'DELETE', undefined, organizerCookie)).status, 200)
})

test('stopping sharing clears the position at once and rejects late points', async () => {
  const invite = await createInvite(marshalCookie)
  await connect(organizerCookie, invite)
  const sharing = await request('/friends/bands/test-band/sharing', 'POST', {}, organizerCookie)
  const sessionId = (await sharing.json()).sharing.sessionId as string
  const device = await registerDevice(organizerCookie, 'android')
  assert.equal((await postPoints(device.token, sessionId, [fixAt()])).status, 200)

  const before = await viewOf(marshalCookie)
  assert.equal(before.friends.find((f) => f.userId === organizer)?.position?.lat, FRIEND_FIX.lat)

  assert.equal((await request('/friends/bands/test-band/sharing', 'DELETE', undefined, organizerCookie)).status, 200)
  const after = await viewOf(marshalCookie)
  const gone = after.friends.find((f) => f.userId === organizer)
  assert.equal(gone?.position, null)
  assert.equal(gone?.sharing, false)

  // A queued point from the ended session must not resurrect the position.
  const late = await postPoints(device.token, sessionId, [fixAt()])
  assert.equal(late.status, 200)
  assert.equal((await late.json()).accepted, 0)
  assert.equal((await viewOf(marshalCookie)).friends.find((f) => f.userId === organizer)?.position, null)
})

test('a replayed older point cannot overwrite a newer one', async () => {
  const sharing = await request('/friends/bands/test-band/sharing', 'POST', {}, marshalCookie)
  const sessionId = (await sharing.json()).sharing.sessionId as string
  const device = await registerDevice(marshalCookie)
  const now = Date.now()
  const newer = { ...FRIEND_FIX, lat: 11.1111, capturedAt: new Date(now).toISOString() }
  const older = { ...FRIEND_FIX, lat: 11.2222, capturedAt: new Date(now - 60_000).toISOString() }

  assert.equal((await (await postPoints(device.token, sessionId, [newer])).json()).accepted, 1)
  const replay = await postPoints(device.token, sessionId, [older])
  assert.equal(replay.status, 200)
  assert.equal((await replay.json()).accepted, 0)
  assert.equal((await viewOf(organizerCookie)).friends.find((f) => f.userId === marshal)?.position?.lat, 11.1111)

  // A batch mixes valid and unusable points without failing the whole batch.
  const mixed = await postPoints(device.token, sessionId, [
    { ...FRIEND_FIX, lat: 11.3333, capturedAt: new Date(now + 1000).toISOString() },
    { lat: 0, lng: 0, accuracy: 5, capturedAt: new Date(now + 2000).toISOString() },
    { lat: 999, lng: 0, accuracy: 5, capturedAt: new Date(now + 3000).toISOString() },
    { lat: 11.4444, lng: -60.4444, accuracy: 900, capturedAt: new Date(now + 4000).toISOString() },
  ])
  const mixedBody = await mixed.json()
  assert.equal(mixedBody.accepted, 2)
  assert.equal(mixedBody.discarded, 2)
})

test('device ingest refuses missing, revoked and malformed credentials', async () => {
  assert.equal((await app.request('/api/friends/positions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401)
  assert.equal((await postPoints('not-a-real-token', randomUUID(), [FRIEND_FIX])).status, 401)

  const device = await registerDevice(marshalCookie)
  assert.equal((await request(`/friends/devices/${device.id}`, 'DELETE', undefined, marshalCookie)).status, 404)
  assert.equal((await request(`/friends/bands/test-band/devices/${device.id}`, 'DELETE', undefined, marshalCookie)).status, 200)
  assert.equal((await postPoints(device.token, randomUUID(), [fixAt()])).status, 401)
  // Revoking twice is a miss, not a second success.
  assert.equal((await request(`/friends/bands/test-band/devices/${device.id}`, 'DELETE', undefined, marshalCookie)).status, 404)
})

test('device tokens are event scoped, expiring and revocable', async () => {
  const device = await registerDevice(marshalCookie, 'android')
  const sharing = await request('/friends/bands/test-band/sharing', 'POST', {}, marshalCookie)
  const sessionId = (await sharing.json()).sharing.sessionId as string
  assert.equal((await postPoints(device.token, sessionId, [fixAt()])).status, 200)

  // An enrolled device cannot post into a different band's session.
  await grantFriends(otherBand)
  const otherSharing = await request('/friends/bands/other-band/sharing', 'POST', {}, marshalCookie)
  const otherSession = (await otherSharing.json()).sharing.sessionId as string
  const crossBand = await postPoints(device.token, otherSession, [fixAt()])
  assert.equal(crossBand.status, 200)
  assert.equal((await crossBand.json()).accepted, 0)

  // An expired token stops working.
  await sql`UPDATE devices SET expires_at = now() - interval '1 minute' WHERE id = ${device.id}::uuid`
  assert.equal((await postPoints(device.token, sessionId, [fixAt()])).status, 401)
})

test('logging out revokes enrolled devices, not just sharing', async () => {
  const device = await registerDevice(outsiderCookie)
  const sharing = await request('/friends/bands/test-band/sharing', 'POST', {}, outsiderCookie)
  const sessionId = (await sharing.json()).sharing.sessionId as string
  assert.equal((await postPoints(device.token, sessionId, [fixAt()])).status, 200)

  const session = await login('outsider@example.test')
  assert.equal((await request('/auth/logout', 'POST', {}, session)).status, 200)

  // A token held by a signed-out phone must not keep posting.
  assert.equal((await postPoints(device.token, sessionId, [fixAt()])).status, 401)
  const listed = await request('/friends/bands/test-band/devices', 'GET', undefined, outsiderCookie)
  assert.deepEqual((await listed.json()).devices, [])
})

test('device enrolment is bounded per person and per band', async () => {
  await sql`DELETE FROM devices WHERE user_id = ${marshal}::uuid`
  const enrolled: string[] = []
  for (let i = 0; i < 5; i++) enrolled.push((await registerDevice(marshalCookie)).id)
  const overLimit = await request('/friends/bands/test-band/devices', 'POST', { platform: 'ios' }, marshalCookie)
  assert.equal(overLimit.status, 409)
  assert.match((await overLimit.json()).error.message, /too many devices/i)

  // Freeing one slot allows enrolment again.
  assert.equal((await request(`/friends/bands/test-band/devices/${enrolled[0]}`, 'DELETE', undefined, marshalCookie)).status, 200)
  assert.ok((await registerDevice(marshalCookie)).id.length > 0)
})

test('an ended event refuses new sharing, invites and devices', async () => {
  const [ended] = await sql<{ id: string }[]>`INSERT INTO bands (slug, name, ends_at) VALUES ('ended-band', 'Ended', now() - interval '1 hour') RETURNING id`
  await grantFriends(ended!.id)
  assert.equal((await request('/friends/bands/ended-band/sharing', 'POST', {}, marshalCookie)).status, 409)
  assert.equal((await request('/friends/bands/ended-band/invites', 'POST', {}, marshalCookie)).status, 409)
  assert.equal((await request('/friends/bands/ended-band/devices', 'POST', { platform: 'ios' }, marshalCookie)).status, 409)
})

test('a revoked session leaves nothing visible, and the sweep clears the row', async () => {
  await sql`DELETE FROM devices WHERE user_id = ${marshal}::uuid`
  const device = await registerDevice(marshalCookie)
  const sharing = await request('/friends/bands/test-band/sharing', 'POST', {}, marshalCookie)
  const sessionId = (await sharing.json()).sharing.sessionId as string
  assert.equal((await postPoints(device.token, sessionId, [fixAt()])).status, 200)
  assert.ok((await sql`SELECT 1 FROM friend_positions WHERE session_id = ${sessionId}::uuid`).length)

  await sql`UPDATE share_sessions SET revoked_at = now() WHERE id = ${sessionId}::uuid`

  // First guarantee: a write against a revoked session stores nothing.
  const refused = await postPoints(device.token, sessionId, [fixAt(0, { lat: 11.44 })] )
  assert.equal(refused.status, 200)
  assert.equal((await refused.json()).accepted, 0)

  // Second: nobody can read the row that was already there, because visibility
  // requires an open session. This is the guarantee that matters.
  const positions = await request('/friends/bands/test-band/positions', 'GET', undefined, organizerCookie)
  assert.equal((await positions.json()).positions.length, 0)

  // Third: the periodic sweep reclaims the row rather than leaving it forever.
  await sweepFriendIngestRows()
  assert.equal((await sql`SELECT count(*)::int AS n FROM friend_positions WHERE session_id = ${sessionId}::uuid`)[0]!.n, 0)
})

test('a crowd signing in is not throttled by a shared proxy address', async () => {
  // Stands in for a request arriving through Firebase Hosting, where the peer
  // address belongs to Google's proxy and is therefore the same for everyone.
  const context = {
    req: { header: (name: string) => (name === "x-forwarded-for" ? "203.0.113.7" : undefined) },
    header: () => undefined,
  } as unknown as Parameters<typeof rateLimit>[0]

  // More sign-ins than the old per-source bucket allowed, all from one address,
  // each for a different account. None of these should be refused.
  for (let i = 0; i < 150; i++) {
    await rateLimit(context, "crowd-login-test", `crowd${i}@example.test`)
  }

  // The per-account bucket still does its job for a single account.
  let refused = false
  for (let i = 0; i < 25; i++) {
    try { await rateLimit(context, "crowd-login-test", "repeated@example.test") }
    catch { refused = true; break }
  }
  assert.equal(refused, true, "one account hammering sign-in must still be limited")
})

test('blocking ends visibility both ways and cannot be undone by a new invite', async () => {
  const organizerView = await viewOf(organizerCookie)
  const connection = organizerView.friends.find((f) => f.userId === marshal)
  assert.ok(connection, 'marshal should still be connected from the earlier test')

  const blocked = await request(`/friends/bands/test-band/connections/${connection.connectionId}/block`, 'POST', {}, organizerCookie)
  assert.equal(blocked.status, 200)
  assert.equal((await sql`SELECT count(*)::int AS n FROM friend_positions WHERE user_id = ${organizer}::uuid`)[0]!.n, 0)

  // The blocker also stops seeing the blocked person.
  const afterBlock = await viewOf(organizerCookie)
  assert.equal(afterBlock.friends.find((f) => f.userId === marshal)?.position ?? null, null)
  const marshalPositions = await request('/friends/bands/test-band/positions', 'GET', undefined, marshalCookie)
  assert.equal((await marshalPositions.json()).positions.length, 0)

  // A fresh invite must not reconnect a blocked pair, in either direction.
  const fromMarshal = await createInvite(marshalCookie)
  assert.equal((await request(`/friends/invites/${fromMarshal.token}/accept`, 'POST', {}, organizerCookie)).status, 403)
})

test('logging out ends sharing and clears the stored position', async () => {
  await grantFriends(band)
  const invite = await createInvite(organizerCookie)
  await connect(outsiderCookie, invite)
  const sharing = await request('/friends/bands/test-band/sharing', 'POST', {}, outsiderCookie)
  const sessionId = (await sharing.json()).sharing.sessionId as string
  const device = await registerDevice(outsiderCookie)
  assert.equal((await postPoints(device.token, sessionId, [fixAt()])).status, 200)
  assert.ok((await viewOf(organizerCookie)).friends.find((f) => f.userId === outsider)?.position)

  // A fresh session cookie, so the shared fixtures stay signed in.
  const session = await login('outsider@example.test')
  assert.equal((await request('/auth/logout', 'POST', {}, session)).status, 200)

  const after = await viewOf(organizerCookie)
  assert.equal(after.friends.find((f) => f.userId === outsider)?.position, null)
  assert.equal((await sql`SELECT count(*)::int AS n FROM friend_positions WHERE user_id = ${outsider}::uuid`)[0]!.n, 0)
  assert.equal((await sql`SELECT count(*)::int AS n FROM share_sessions WHERE user_id = ${outsider}::uuid AND ended_at IS NULL`)[0]!.n, 0)
})

test('a truncated invite link gets a human answer', async () => {
  const res = await request('/friends/invites/not-a-real-token/accept', 'POST', {}, marshalCookie)
  assert.equal(res.status, 400)
  assert.match((await res.json()).error.message, /incomplete/i)
})

test('the browser can share without the native app', async () => {
  await grantFriends(band)
  const invite = await createInvite(organizerCookie)
  await connect(outsiderCookie, invite)
  const sharing = await request('/friends/bands/test-band/sharing', 'POST', {}, outsiderCookie)
  const sessionId = (await sharing.json()).sharing.sessionId as string

  const res = await postBrowserPoints(outsiderCookie, sessionId, [browserFixAt()])
  assert.equal(res.status, 200, await res.clone().text())
  assert.equal((await res.json()).accepted, 1)

  const view = await viewOf(organizerCookie)
  const friend = view.friends.find((f) => f.userId === outsider)
  assert.ok(friend)
  assert.equal(friend.position?.lat, FRIEND_FIX.lat)
  assert.equal(friend.freshness, 'live')
  // The writer is recorded, and a browser never claims a motion state.
  assert.equal((await sql`SELECT source, motion_state FROM friend_positions WHERE user_id = ${outsider}::uuid`)[0]?.source, 'browser')
  assert.equal((await sql`SELECT motion_state FROM friend_positions WHERE user_id = ${outsider}::uuid`)[0]?.motion_state, 'unknown')
})

test('a browser fix is trusted only briefly, so a closed tab stops showing a pin', async () => {
  const now = Date.now()
  const base = { lat: 11, lng: -60, accuracy_m: 10, heading: null }
  // Browser: recent enough, or withheld. No motion nuance.
  assert.equal(fixFreshness({ ...base, source: 'browser', motion_state: 'unknown', captured_at: new Date(now - 30_000) }, now), 'live')
  assert.equal(fixFreshness({ ...base, source: 'browser', motion_state: 'unknown', captured_at: new Date(now - 91_000) }, now), 'abandoned')
  // Native keeps the motion-aware window: a parked phone still reads as present.
  assert.equal(fixFreshness({ ...base, source: 'native', motion_state: 'stationary', captured_at: new Date(now - 10 * 60_000) }, now), 'stationary')
  assert.equal(fixFreshness({ ...base, source: 'native', motion_state: 'unknown', captured_at: new Date(now - 91_000) }, now), 'live')
})

test('a stale browser fix is withheld from friends even though the row remains', async () => {
  const sharing = await request('/friends/bands/test-band/sharing', 'POST', {}, outsiderCookie)
  const sessionId = (await sharing.json()).sharing.sessionId as string
  assert.equal((await postBrowserPoints(outsiderCookie, sessionId, [browserFixAt()])).status, 200)

  // Simulate a phone whose tab was closed two minutes ago.
  await sql`UPDATE friend_positions SET captured_at = now() - interval '2 minutes' WHERE user_id = ${outsider}::uuid`
  const view = await viewOf(organizerCookie)
  const friend = view.friends.find((f) => f.userId === outsider)
  assert.equal(friend?.position, null, 'a withheld fix must not expose coordinates')
  assert.equal(friend?.freshness, null)
  // Their session is still open, so "sharing" stays true. It is the reported
  // position that is withheld, which is exactly the distinction the UI needs.
  assert.equal(friend?.sharing, true)
})

test('both writers share one pipeline: monotonic writes and session scoping', async () => {
  const sharing = await request('/friends/bands/test-band/sharing', 'POST', {}, outsiderCookie)
  const sessionId = (await sharing.json()).sharing.sessionId as string
  const now = Date.now()
  assert.equal((await postBrowserPoints(outsiderCookie, sessionId, [browserFixAt(0, { lat: 11.5 })])).status, 200)

  // A replayed older browser point cannot overwrite a newer one.
  const replay = await postBrowserPoints(outsiderCookie, sessionId, [browserFixAt(-60_000, { lat: 11.6 })])
  assert.equal(replay.status, 200)
  assert.equal((await replay.json()).accepted, 0)
  assert.equal((await sql`SELECT lat FROM friend_positions WHERE user_id = ${outsider}::uuid`)[0]?.lat, 11.5)

  // A browser write is refused once the session has ended.
  assert.equal((await request('/friends/bands/test-band/sharing', 'DELETE', undefined, outsiderCookie)).status, 200)
  const afterStop = await postBrowserPoints(outsiderCookie, sessionId, [browserFixAt(0, { lat: 11.7, capturedAt: new Date(now + 5000).toISOString() })])
  assert.equal(afterStop.status, 409)
})

test('concurrent writes do not exhaust the connection pool', async () => {
  // Regression guard. `writePoints` used to check entitlement from inside
  // `sql.begin`, which needs a second pooled connection while the transaction
  // holds one. Past the pool size of 10, every writer waited on a connection
  // only it could release, and the API stopped answering entirely. Ten plus one
  // concurrent writers is therefore the number that matters, not a round one.
  const CONCURRENCY = 12
  await grantFriends(band)

  // Accounts and sessions are inserted directly. Passwords are irrelevant here
  // and hashing them twelve times would only slow the suite down.
  const writers: { token: string; sessionId: string }[] = []
  for (let i = 0; i < CONCURRENCY; i++) {
    const userId = randomUUID()
    const token = randomBytes(32).toString("hex")
    await sql`INSERT INTO users (id, email, password_hash) VALUES (${userId}, ${`pool${i}@example.test`}, 'x')`
    await sql`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (${sha256(token)}, ${userId}, now() + interval '1 hour')`
    const [session] = await sql<{ id: string }[]>`
      INSERT INTO share_sessions (user_id, band_id, ends_at)
      VALUES (${userId}::uuid, ${band}::uuid, now() + interval '2 hours')
      RETURNING id
    `
    writers.push({ token, sessionId: session!.id })
  }

  const started = Date.now()
  const results = await Promise.all(writers.map((writer) =>
    request('/friends/bands/test-band/positions', 'POST', {
      sessionId: writer.sessionId,
      points: [browserFixAt()],
    }, `__session=${writer.token}`),
  ))

  // Without the fix these never resolve, so a bounded wait is the actual
  // assertion: a hang here is the failure mode being guarded against.
  assert.ok(Date.now() - started < 15_000, 'concurrent writes must not deadlock on the pool')
  for (const res of results) assert.equal(res.status, 200, await res.clone().text())
  assert.equal((await sql`SELECT count(*)::int AS n FROM friend_positions WHERE band_id = ${band}::uuid`)[0]!.n, CONCURRENCY)
})

test('a browser cannot write into another band or another person session', async () => {
  await grantFriends(otherBand)
  const mine = await request('/friends/bands/test-band/sharing', 'POST', {}, organizerCookie)
  const mySession = (await mine.json()).sharing.sessionId as string
  const otherSharing = await request('/friends/bands/other-band/sharing', 'POST', {}, outsiderCookie)
  const otherSession = (await otherSharing.json()).sharing.sessionId as string

  // The right band with someone else's session id.
  assert.equal((await postBrowserPoints(organizerCookie, otherSession, [browserFixAt()])).status, 409)
  // The wrong band with a real session of my own.
  assert.equal((await postBrowserPoints(organizerCookie, mySession, [browserFixAt()], 'other-band')).status, 409)
  // Browser ingest still requires a signed-in account.
  assert.equal((await request('/friends/bands/test-band/positions', 'POST', { sessionId: mySession, points: [browserFixAt()] })).status, 401)
})

test('native ingest accepts a batch larger than the web body limit', async () => {
  await sql`DELETE FROM devices WHERE user_id = ${marshal}::uuid`
  const device = await registerDevice(marshalCookie)
  const sharing = await request('/friends/bands/test-band/sharing', 'POST', {}, marshalCookie)
  const sessionId = (await sharing.json()).sharing.sessionId as string

  // The SDK uploads queued points, so a batch is legitimately larger than the
  // 16 KB web limit. 150 points with UUIDs clears that comfortably.
  const now = Date.now()
  const batch = Array.from({ length: 150 }, (_, i) =>
    fixAt(0, { lat: 11 + i / 10_000, lng: -60 - i / 10_000, capturedAt: new Date(now + i).toISOString(), locationUuid: randomUUID() }))
  const body = JSON.stringify({ sessionId, points: batch })
  assert.ok(body.length > 16_384, `batch should exceed the web limit, was ${body.length}`)

  const res = await postPoints(device.token, sessionId, batch)
  assert.equal(res.status, 200, await res.clone().text())
  assert.equal((await res.json()).accepted, batch.length)

  // The exemption must stay narrow: browser routes keep the small limit.
  const fatBrowserWrite = await request('/auth/login', 'POST', { email: 'a@b.test', password: 'x'.repeat(20_000) }, '')
  assert.equal(fatBrowserWrite.status, 413)
})

test('friend routes require a signed-in account', async () => {
  for (const [path, method] of [
    ['/friends/bands/test-band', 'GET'],
    ['/friends/bands/test-band/invites', 'POST'],
    ['/friends/bands/test-band/sharing', 'POST'],
    ['/friends/bands/test-band/positions', 'GET'],
    ['/friends/bands/test-band/positions', 'POST'],
    ['/friends/bands/test-band/devices', 'POST'],
    ['/friends/bands/test-band/devices', 'GET'],
  ] as const) {
    assert.equal((await request(path, method)).status, 401)
  }
})

test('friend positions are isolated per band and per pair', async () => {
  await grantFriends(otherBand)
  const otherInvite = await createInvite(outsiderCookie, 'other-band')
  await connect(platformCookie, otherInvite)
  const otherSharing = await request('/friends/bands/other-band/sharing', 'POST', {}, outsiderCookie)
  const otherSession = (await otherSharing.json()).sharing.sessionId as string
  const otherDevice = await registerDevice(outsiderCookie)
  assert.equal((await postPoints(otherDevice.token, otherSession, [fixAt()])).status, 200)

  // An organizer in test-band must not see other-band friends.
  const view = await viewOf(organizerCookie, 'other-band')
  assert.equal(view.friends.length, 0)
})

test('freshness is motion aware and withholds abandoned fixes', () => {
  const now = Date.now()
  const base = { lat: 11, lng: -60, accuracy_m: 10, heading: null }
  assert.equal(fixFreshness({ ...base, motion_state: 'moving', captured_at: new Date(now - 30_000) }, now), 'live')
  assert.equal(fixFreshness({ ...base, motion_state: 'moving', captured_at: new Date(now - 150_000) }, now), 'stale')
  // A stationary friend reports rarely; that must not read as lost.
  assert.equal(fixFreshness({ ...base, motion_state: 'stationary', captured_at: new Date(now - 10 * 60_000) }, now), 'stationary')
  assert.equal(fixFreshness({ ...base, motion_state: 'stationary', captured_at: new Date(now - 30 * 60_000) }, now), 'stale')
  assert.equal(fixFreshness({ ...base, motion_state: 'moving', captured_at: new Date(now - 60 * 60_000) }, now), 'abandoned')
})

test('point validation rejects nonsense and clamps accuracy', () => {
  const now = Date.now()
  const valid = { lat: 11, lng: -60, accuracy: 10, capturedAt: new Date(now).toISOString() }
  assert.equal(sanitizePoint(valid, now).ok, true)
  assert.equal(sanitizePoint({ ...valid, lat: 0, lng: 0 }, now).ok, false)
  assert.equal(sanitizePoint({ ...valid, lat: 91 }, now).ok, false)
  assert.equal(sanitizePoint({ ...valid, accuracy: -1 }, now).ok, false)
  assert.equal(sanitizePoint({ ...valid, capturedAt: new Date(now + 30 * 60_000).toISOString() }, now).ok, false)
  assert.equal(sanitizePoint({ lat: 11, lng: -60, accuracy: 10 }, now).ok, false)
  const clamped = sanitizePoint({ ...valid, accuracy: 900 }, now)
  assert.equal(clamped.ok && clamped.point.accuracy, 200)
  const unitHeading = sanitizePoint({ ...valid, heading: 3599 }, now)
  assert.equal(unitHeading.ok && unitHeading.point.heading, null)
})

// ---------------------------------------------------------------------------
// Observability
//
// The readiness check exists because a connection-pool deadlock silently took
// this API down: it stayed running while refusing to answer. These tests prove
// the check detects that state, which is the only reason to have it.
// ---------------------------------------------------------------------------

test('readiness reports unhealthy when the pool is starved by abandoned transactions', async () => {
  const { readiness } = await import("../server/observability/health.ts")

  const healthy = await readiness()
  assert.equal(healthy.ok, true, "a quiet database must read as ready")
  assert.equal(healthy.poolStarved, false)

  // Hold connections open inside transactions and do nothing with them. The
  // pool holds ten, so six is enough to trip the threshold with room for the
  // probes themselves.
  const abandoned: Promise<unknown>[] = []
  for (let i = 0; i < 6; i++) {
    abandoned.push(
      sql.begin(async (tx) => {
        await tx`SELECT 1`
        await new Promise((resolve) => setTimeout(resolve, 4000))
      }).catch(() => undefined),
    )
  }
  await new Promise((resolve) => setTimeout(resolve, 1200))

  const starved = await readiness()
  assert.equal(starved.poolStarved, true, "abandoned transactions must be detected")
  assert.equal(starved.ok, false, "a starved pool must not report ready")
  assert.ok(starved.idleInTransaction >= 5, `expected idle transactions, saw ${starved.idleInTransaction}`)

  await Promise.all(abandoned)
  await new Promise((resolve) => setTimeout(resolve, 400))
  assert.equal((await readiness()).ok, true, "readiness must recover once the transactions end")
})

test('the health endpoints report status without leaking connection detail', async () => {
  const live = await request("/health/live")
  assert.equal(live.status, 200)
  const liveBody = await live.json()
  assert.equal(liveBody.ok, true)
  assert.equal(typeof liveBody.databaseMs, "number")
  assert.doesNotMatch(JSON.stringify(liveBody), /postgres|password|6543|pooler|supabase/i)

  const ready = await request("/health/ready")
  assert.equal(ready.status, 200)
  assert.equal((await ready.json()).poolStarved, false)

  // The original endpoint stays, because a platform uptime check depends on it.
  const original = await request("/health")
  assert.equal(original.status, 200)
  assert.deepEqual(await original.json(), { ok: true, product: "truck-tracker", version: "1.2.0" })
})

test('client error reports are accepted, bounded and never echo content back', async () => {
  const res = await request("/client-errors", "POST", {
    message: "TypeError: x is not a function",
    route: "/fog-angels/friends",
    bandSlug: "fog-angels",
    stack: "at Foo (app.js:1:1)",
  })
  assert.equal(res.status, 202)
  const body = await res.json()
  assert.equal(body.ok, true)
  assert.match(body.correlationId, /^[a-f0-9]{12}$/)
  assert.doesNotMatch(JSON.stringify(body), /TypeError|fog-angels/)

  assert.equal((await request("/client-errors", "POST", { message: "" })).status, 400)
  assert.equal((await request("/client-errors", "POST", {})).status, 400)
  assert.equal((await request("/client-errors", "POST", { message: "x".repeat(600) })).status, 400)
})

test('no stack trace ever reaches a client', async () => {
  const res = await request("/definitely-not-a-route")
  const text = await res.text()
  assert.doesNotMatch(text, /at .*\(.*:\d+:\d+\)/, "a stack trace must never cross the boundary")
})
