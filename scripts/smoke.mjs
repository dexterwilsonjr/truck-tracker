/**
 * External smoke check for the deployed site.
 *
 *   node scripts/smoke.mjs                       # production
 *   SMOKE_ORIGIN=https://... node scripts/smoke.mjs
 *
 * This runs from outside the platform on purpose. The Cloud Monitoring policies
 * watch the service from inside Google's stack, which cannot tell you that
 * Hosting is serving a stale bundle, that a rewrite is broken, or that the site
 * is unreachable because of a DNS or certificate problem. This checks the thing
 * a patron actually touches.
 *
 * Deliberately read-only. It never creates, changes or deletes anything, so it
 * is safe to run against production every few minutes. Anything needing a
 * signed-in account to write belongs in the assurance script, not here.
 */
const BASE = (process.env.SMOKE_ORIGIN ?? "https://windies-truck-tracker.web.app").replace(/\/$/, "")
const BAND = process.env.SMOKE_BAND ?? "fog-angels"
const TIMEOUT_MS = 15_000

const failures = []

async function check(name, run) {
  const started = Date.now()
  try {
    const detail = await run()
    console.log(`PASS  ${String(Date.now() - started).padStart(5)}ms  ${name}${detail ? `  ${detail}` : ""}`)
  } catch (error) {
    failures.push(`${name}: ${error.message}`)
    console.log(`FAIL  ${String(Date.now() - started).padStart(5)}ms  ${name}  ${error.message}`)
  }
}

async function get(path, expect = 200) {
  const res = await fetch(`${BASE}${path}`, {
    // The origin guard applies to writes, and several checks below are writes.
    // A browser always sends Origin; so must this, or it tests a path no real
    // client would take.
    headers: { Origin: BASE },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: "manual",
  })
  if (res.status !== expect) throw new Error(`expected ${expect}, got ${res.status}`)
  return res
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

// The site itself, and that it is not showing a placeholder build.
await check("SPA shell loads", async () => {
  const res = await get("/")
  const html = await res.text()
  assert(/<div id="root"/.test(html), "no app root in the HTML")
  assert(!/<title>\s*<\/title>/.test(html), "empty title")
  return "ok"
})

// The documented health surface.
await check("/api/health", async () => {
  const res = await get("/api/health")
  const body = await res.json()
  assert(body.ok === true, "not ok")
  assert(body.version, "no version")
  return `v${body.version}`
})

await check("/api/health/live", async () => {
  const res = await get("/api/health/live")
  const body = await res.json()
  assert(body.ok === true, "not live")
  // A slow probe is the earliest warning of database trouble, so report it even
  // while passing. It should stay well under a second.
  return `db ${body.databaseMs}ms`
})

await check("/api/health/ready", async () => {
  const res = await fetch(`${BASE}/api/health/ready`, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (res.status === 503) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`unready: poolStarved=${body.poolStarved} idle=${body.idleInTransaction}`)
  }
  assert(res.status === 200, `expected 200, got ${res.status}`)
  const body = await res.json()
  assert(body.poolStarved === false, "pool starved")
  return `db ${body.databaseMs}ms`
})

// Public data a patron depends on. A 200 with no content is still a broken site.
await check("band payload", async () => {
  const res = await get(`/api/public/bands/${BAND}`)
  const body = await res.json()
  assert(body.band?.slug === BAND, `expected band ${BAND}`)
  assert(Array.isArray(body.band.liveModules), "no liveModules")
  return `${body.band.liveModules.length} live module(s)`
})

await check("tracker snapshot", async () => {
  const res = await get(`/api/public/bands/${BAND}/tracker`)
  const body = await res.json()
  assert(body.truck, "no truck in the payload")
  assert(typeof body.truck.status === "string", "no status")
  return body.truck.status
})

await check("guide content", async () => {
  const res = await get(`/api/public/bands/${BAND}/content/guide`)
  const body = await res.json()
  assert(body.content, "no guide content")
  return "ok"
})

// Private routes must refuse an anonymous caller. A 200 here would be a leak,
// and a 5xx would mean the gate itself is broken.
await check("friend routes refuse anonymous callers", async () => {
  for (const path of [`/api/friends/bands/${BAND}`, `/api/friends/bands/${BAND}/positions`]) {
    const res = await fetch(`${BASE}${path}`, { headers: { Origin: BASE }, signal: AbortSignal.timeout(TIMEOUT_MS) })
    assert([401, 403].includes(res.status), `${path} returned ${res.status}`)
  }
  return "401"
})

await check("native ingest refuses a forged token", async () => {
  const res = await fetch(`${BASE}/api/friends/positions`, {
    method: "POST",
    // No Origin on purpose: the native path is exempt from the origin guard and
    // authenticates by device token, so this is the exact shape a real device
    // request has.
    headers: { "Content-Type": "application/json", Authorization: "Bearer smoke-test-not-a-token" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({ sessionId: "00000000-0000-0000-0000-000000000000", points: [] }),
  })
  assert(res.status === 401, `expected 401, got ${res.status}`)
  return "401"
})

// The client error path must accept reports, or patron-side breakage is invisible.
await check("client error intake works", async () => {
  const res = await fetch(`${BASE}/api/client-errors`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({ message: "scheduled smoke check", route: "/smoke" }),
  })
  assert(res.status === 202, `expected 202, got ${res.status}`)
  return "202"
})

console.log("")
if (failures.length) {
  console.log(`${failures.length} check(s) failed:`)
  for (const failure of failures) console.log(`  - ${failure}`)
  process.exit(1)
}
console.log(`All checks passed against ${BASE}`)
