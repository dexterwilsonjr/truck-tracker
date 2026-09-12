import "dotenv/config"
import postgres from "postgres"

import { hashPassword } from "../server/auth/passwords.ts"

/**
 * Concurrency check for friend sharing.
 *
 *   LOAD_TEST_PASSWORD='<12+ chars>' npm run load:friends -- --users 100 --viewers 100 --seconds 60
 *
 * Drives the real HTTP surface — sign-in, position writes, and the friends read
 * — the way a crowd of phones would, and reports latency percentiles. The unit
 * and browser tests prove correctness; this is the only thing that measures what
 * a hundred people at once actually costs.
 *
 * Safety: refuses to run against anything that is not a local test database. The
 * API under test must already be running and pointed at that same database:
 *
 *   DATABASE_URL=postgres://truck:local-test-only@127.0.0.1:55432/truck_tracker_test npm run dev:server
 */

function arg(name: string, fallback: number): number {
  const index = process.argv.indexOf(`--${name}`)
  if (index === -1) return fallback
  const value = Number(process.argv[index + 1])
  return Number.isSafeInteger(value) && value > 0 ? value : fallback
}

const USERS = arg("users", 100)
const VIEWERS = arg("viewers", USERS)
const DEGREE = arg("degree", 3)
const SECONDS = arg("seconds", 60)
const WRITE_INTERVAL_MS = arg("write-ms", 8000)
const READ_INTERVAL_MS = arg("read-ms", 5000)
const BASE = process.env.LOAD_BASE_URL ?? "http://127.0.0.1:8788"
const ORIGIN = process.env.LOAD_ORIGIN ?? "http://localhost:5173"
const SLUG = process.env.LOAD_BAND_SLUG ?? "load-band"

const databaseUrl = process.env.DATABASE_URL ?? ""
const parsed = databaseUrl ? new URL(databaseUrl) : null
if (!parsed || !["127.0.0.1", "localhost"].includes(parsed.hostname) || !parsed.pathname.endsWith("_test")) {
  console.error("Refusing to run: DATABASE_URL must be a localhost database whose name ends in _test.")
  process.exit(1)
}
const password = process.env.LOAD_TEST_PASSWORD ?? ""
if (password.length < 12) {
  console.error("Set LOAD_TEST_PASSWORD to at least 12 characters.")
  process.exit(1)
}

const sql = postgres(databaseUrl, { max: 4, prepare: false, connect_timeout: 20 })

console.log(`Preparing ${USERS} users with degree ${DEGREE} connections in band "${SLUG}"…`)

// A dedicated band, so load data never mixes with a client's.
const [band] = await sql<{ id: string }[]>`
  INSERT INTO bands (slug, name, ends_at) VALUES (${SLUG}, 'Load test band', now() + interval '7 days')
  ON CONFLICT (slug) DO UPDATE SET ends_at = EXCLUDED.ends_at
  RETURNING id
`
await sql`
  INSERT INTO band_entitlements (band_id, module_code, status, starts_at, ends_at)
  VALUES (${band!.id}::uuid, 'friends', 'active', now() - interval '1 day', null)
  ON CONFLICT (band_id, module_code) DO UPDATE SET status = 'active', starts_at = now() - interval '1 day', ends_at = null
`

const hash = await hashPassword(password)
const users: { id: string; email: string }[] = []
for (let i = 1; i <= USERS; i++) {
  const email = `load${String(i).padStart(4, "0")}@load.test`
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO users (email, password_hash, name, platform_role)
    VALUES (${email}, ${hash}, ${`Load ${i}`}, 'patron')
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
    RETURNING id
  `
  users.push({ id: row!.id, email })
}

// A ring, so each person has a few friends rather than everyone seeing everyone.
for (let i = 0; i < users.length; i++) {
  for (let d = 1; d <= DEGREE; d++) {
    const other = users[(i + d) % users.length]!
    if (other.id === users[i]!.id) continue
    await sql`
      INSERT INTO connections (band_id, requester_id, addressee_id, status, responded_at)
      VALUES (${band!.id}::uuid, ${users[i]!.id}::uuid, ${other.id}::uuid, 'accepted', now())
      ON CONFLICT (band_id, LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id))
        DO UPDATE SET status = 'accepted'
    `
  }
}

console.log("Signing in…")
// Sign-in clears any previous cookie and then sets the new one, so there are
// two Set-Cookie headers and the *last* is the live session. A browser would
// take the last as well.
const clients: { cookie: string; sessionId: string }[] = []
const loginErrors: string[] = []
for (const user of users) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { Origin: ORIGIN, "Content-Type": "application/json" },
    body: JSON.stringify({ email: user.email, password }),
  })
  if (!res.ok) { loginErrors.push(`${user.email}:${res.status}`); continue }
  const raw = res.headers.getSetCookie?.() ?? []
  const cookie = raw
    .map((c) => c.split(";")[0])
    .filter((c) => c?.startsWith("__session=") && !c.endsWith("="))
    .at(-1)
  if (!cookie) { loginErrors.push(`${user.email}:no-cookie`); continue }

  const started = await fetch(`${BASE}/api/friends/bands/${SLUG}/sharing`, { method: "POST", headers: { Origin: ORIGIN, Cookie: cookie } })
  if (!started.ok) { loginErrors.push(`${user.email}:share-${started.status}`); continue }
  const body = await started.json() as { sharing?: { sessionId?: string } }
  if (body.sharing?.sessionId) clients.push({ cookie, sessionId: body.sharing.sessionId })
  else loginErrors.push(`${user.email}:no-session`)
}
if (loginErrors.length) console.log(`Sign-in problems: ${loginErrors.length} (${loginErrors.slice(0, 5).join(", ")})`)
if (!clients.length) { console.error("No usable sessions. Is the API running against this database?"); await sql.end({ timeout: 5 }); process.exit(1) }
console.log(`Signed in and sharing: ${clients.length} of ${USERS}.`)

const latencies: { write: number[]; read: number[] } = { write: [], read: [] }
const errors = { write: 0, read: 0 }
let writes = 0, reads = 0
const deadline = Date.now() + SECONDS * 1000

function record(kind: "write" | "read", ms: number) {
  latencies[kind].push(ms)
  if (kind === "write") writes++; else reads++
}

async function writer(index: number) {
  const client = clients[index % clients.length]!
  while (Date.now() < deadline) {
    const started = performance.now()
    try {
      const res = await fetch(`${BASE}/api/friends/bands/${SLUG}/positions`, {
        method: "POST",
        headers: { Origin: ORIGIN, "Content-Type": "application/json", Cookie: client.cookie },
        body: JSON.stringify({
          sessionId: client.sessionId,
          points: [{ lat: 11.18 + index / 100_000, lng: -60.73 - index / 100_000, accuracy: 10, heading: null, capturedAt: new Date().toISOString() }],
        }),
      })
      if (!res.ok) errors.write++
      await res.arrayBuffer()
    } catch { errors.write++ }
    record("write", performance.now() - started)
    await new Promise((r) => setTimeout(r, WRITE_INTERVAL_MS))
  }
}

async function viewer(index: number) {
  const client = clients[index % clients.length]!
  while (Date.now() < deadline) {
    const started = performance.now()
    try {
      const res = await fetch(`${BASE}/api/friends/bands/${SLUG}`, { headers: { Origin: ORIGIN, Cookie: client.cookie } })
      if (!res.ok) errors.read++
      await res.arrayBuffer()
    } catch { errors.read++ }
    record("read", performance.now() - started)
    await new Promise((r) => setTimeout(r, READ_INTERVAL_MS))
  }
}

console.log(`Running ${USERS} writers (every ${WRITE_INTERVAL_MS}ms) and ${VIEWERS} viewers (every ${READ_INTERVAL_MS}ms) for ${SECONDS}s…`)
await Promise.all([
  ...Array.from({ length: USERS }, (_, i) => writer(i)),
  ...Array.from({ length: VIEWERS }, (_, i) => viewer(i)),
])

function percentile(values: number[], p: number): number {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return Math.round(sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]!)
}

const connections = await sql<{ used: number }[]>`SELECT count(*)::int AS used FROM pg_stat_activity WHERE datname = current_database()`
await sql.end({ timeout: 5 })

console.log("\n--- Results ---")
console.log(`Writes ${writes} (errors ${errors.write}) · Reads ${reads} (errors ${errors.read})`)
console.log(`Write ms  p50 ${percentile(latencies.write, 50)}  p95 ${percentile(latencies.write, 95)}  p99 ${percentile(latencies.write, 99)}`)
console.log(`Read  ms  p50 ${percentile(latencies.read, 50)}  p95 ${percentile(latencies.read, 95)}  p99 ${percentile(latencies.read, 99)}`)
console.log(`Database connections in use at end: ${connections[0]?.used ?? "?"}`)

const readP95 = percentile(latencies.read, 95)
const writeP95 = percentile(latencies.write, 95)
const budget = 500
if (errors.read || errors.write) console.log(`FAIL: ${errors.read + errors.write} request error(s).`)
else if (readP95 > budget || writeP95 > budget) console.log(`FAIL: p95 above the ${budget}ms budget.`)
else console.log(`PASS: p95 within the ${budget}ms budget with no request errors.`)

console.log(`\nLoad data is left in band "${SLUG}" for inspection. Remove it with:`)
console.log(`  DELETE FROM bands WHERE slug = '${SLUG}';`)
