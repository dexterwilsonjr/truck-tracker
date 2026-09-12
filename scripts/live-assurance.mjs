import { chromium } from "@playwright/test"
import { execFileSync } from "node:child_process"
import { writeFileSync } from "node:fs"
import { randomUUID } from "node:crypto"

/**
 * Live assurance against a deployed environment.
 *
 * Defaults to production. `LIVE_ORIGIN`, `LIVE_BAND_SLUG` and the credential
 * overrides exist so the same checks can be pointed at a staging or local
 * environment, which is how the friend-sharing assertions below were developed
 * rather than being written blind against production.
 *
 *   LIVE_ORIGIN=http://127.0.0.1:4173 LIVE_BAND_SLUG=browser-band \
 *   LIVE_CREW_EMAIL=... LIVE_CREW_PASSWORD=... node scripts/live-assurance.mjs
 *
 * Read-only where it matters. The friend-sharing section never creates a
 * connection or a position unless `LIVE_FRIENDS_ROUNDTRIP=true` is set, so it is
 * safe to run while patrons are live.
 */
const origin = process.env.LIVE_ORIGIN ?? "https://windies-truck-tracker.web.app"
const BAND = process.env.LIVE_BAND_SLUG ?? "tobago-carnival"
const ROUNDTRIP = process.env.LIVE_FRIENDS_ROUNDTRIP === "true"

const fail = []
const pass = []
function ok(name, detail = "") {
  pass.push(detail ? `${name}: ${detail}` : name)
  console.log("PASS", name, detail)
}
function bad(name, detail) {
  fail.push(`${name}: ${detail}`)
  console.log("FAIL", name, detail)
}
async function json(path, init = {}) {
  const res = await fetch(`${origin}${path}`, {
    ...init,
    headers: {
      Origin: origin,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    redirect: "manual",
  })
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = { raw: text.slice(0, 200) } }
  return { res, data }
}
function cookieHeader(res) {
  const raw = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [res.headers.get("set-cookie")].filter(Boolean)
  return raw.join("; ")
}
/**
 * Sign-in clears a previous cookie and then sets the new one, so the response
 * carries two Set-Cookie headers and the last is the live session. Taking the
 * first yields the empty clearing cookie and every later call returns 401.
 */
function sessionCookie(res) {
  const raw = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [res.headers.get("set-cookie")].filter(Boolean)
  const found = raw.map((value) => String(value).split(";")[0]).filter((value) => value.startsWith("__session=") && value !== "__session=")
  return found.at(-1) ?? ""
}

const seed = process.env.LIVE_CREW_EMAIL
  ? {}
  : JSON.parse(execFileSync("gcloud", ["secrets", "versions", "access", "latest", "--secret=truck-tracker-seed", "--project=windies-app"], { encoding: "utf8" }))
const crew = { email: process.env.LIVE_CREW_EMAIL ?? seed.SEED_ORGANIZER_EMAIL, password: process.env.LIVE_CREW_PASSWORD ?? seed.SEED_ORGANIZER_PASSWORD }
const platform = { email: process.env.LIVE_PLATFORM_EMAIL ?? seed.PLATFORM_ADMIN_EMAIL, password: process.env.LIVE_PLATFORM_PASSWORD ?? seed.PLATFORM_ADMIN_PASSWORD }
/** The second person for the optional friend round trip. */
const second = { email: process.env.LIVE_SECOND_EMAIL ?? "", password: process.env.LIVE_SECOND_PASSWORD ?? "" }

/**
 * The privacy invariant, stated so it holds on any environment.
 *
 * Asserting "this account has no friends" would only be meaningful on a fresh
 * database, and it is false after any legitimate connection exists. What must
 * always hold is that a position is only ever returned for someone the account
 * has an accepted connection to. So the map read is cross-checked against the
 * connection list: any coordinate without a matching accepted connection is a leak.
 */
async function assertFriendPrivacy(headers, who) {
  const view = await json(`/api/friends/bands/${BAND}`, { headers })
  if (view.res.status === 401) { ok(`friend privacy (${who})`, "sign-in required"); return }
  if (view.res.status === 403) { ok(`friend privacy (${who})`, "module not entitled for this band"); return }
  if (view.res.status !== 200) { bad(`friend privacy (${who})`, `${view.res.status} ${JSON.stringify(view.data)}`); return }

  const friends = view.data?.friends ?? []
  const accepted = new Set(friends.filter((f) => f.status === "accepted").map((f) => f.userId))

  const positions = await json(`/api/friends/bands/${BAND}/positions`, { headers })
  if (positions.res.status !== 200) { bad(`friend privacy (${who})`, `positions ${positions.res.status}`); return }
  const rows = positions.data?.positions ?? []
  const leaked = rows.filter((row) => !accepted.has(row.userId))

  if (leaked.length) bad(`friend privacy (${who})`, `${leaked.length} position(s) without an accepted connection`)
  else ok(`friend privacy (${who})`, `${accepted.size} accepted connection(s), ${rows.length} position(s), no unauthorised row`)
}

try {
  const health = await json("/api/health")
  if (health.res.status === 200 && health.data?.ok && health.data.version === "1.2.0") ok("health", health.data.version)
  else bad("health", JSON.stringify(health.data))

  const band = await json(`/api/public/bands/${BAND}`)
  const live = band.data?.band?.liveModules ?? []
  if (live.every((code) => band.data.band.deployedPackages.includes(code))) ok("live modules", live.join(","))
  else bad("live modules", JSON.stringify(live))

  const before = await json(`/api/public/bands/${BAND}/tracker`)
  if (before.data?.truck?.status === "not-live" && before.data.truck.position === null && /Not on the road yet/i.test(before.data.truck.message)) ok("tracker idle")
  else bad("tracker idle", JSON.stringify(before.data?.truck))

  const guide = await json(`/api/public/bands/${BAND}/content/guide`)
  if (guide.res.status === 200 && guide.data?.content?.title) ok("guide", guide.data.content.title)
  else bad("guide", JSON.stringify(guide.data))
  const updates = await json(`/api/public/bands/${BAND}/content/updates`)
  if (updates.res.status === 200 && Array.isArray(updates.data?.content) && updates.data.content.length) ok("updates", String(updates.data.content.length))
  else bad("updates", JSON.stringify(updates.data))
  const photos = await json(`/api/public/bands/${BAND}/content/photos`)
  if ([403, 404].includes(photos.res.status)) ok("photos API gated", String(photos.res.status))
  else bad("photos API gated", String(photos.res.status))

  const unauthAdmin = await json(`/api/admin/bands/${BAND}/tracker`)
  if (unauthAdmin.res.status === 401) ok("admin requires session")
  else bad("admin requires session", String(unauthAdmin.res.status))

  const csrf = await json("/api/auth/login", { method: "POST", headers: { Origin: "https://elsewhere.test" }, body: JSON.stringify(crew) })
  if (csrf.res.status === 403) ok("cross-origin login blocked")
  else bad("cross-origin login blocked", String(csrf.res.status))

  const login = await json("/api/auth/login", { method: "POST", body: JSON.stringify(crew) })
  const cookie = sessionCookie(login.res)
  const cookieLine = cookieHeader(login.res)
  if (login.res.status === 200 && cookie && /Path=\//i.test(cookieLine) && /Secure/i.test(cookieLine) && /SameSite=Lax/i.test(cookieLine)) ok("crew login cookie")
  else bad("crew login cookie", `status ${login.res.status} cookie=${Boolean(cookie)}`)
  const auth = { Cookie: cookie }

  // ---------------------------------------------------------------------
  // Friend sharing privacy. These are the checks that matter before real
  // people share real locations, and they are read-only.
  // ---------------------------------------------------------------------

  const anonList = await json(`/api/friends/bands/${BAND}`)
  if (anonList.res.status === 401 || anonList.res.status === 403) {
    if (anonList.res.status === 401) ok("friend list requires session")
    else ok("friend list requires session", "band not entitled")
  } else bad("friend list requires session", String(anonList.res.status))

  const anonRead = await json(`/api/friends/bands/${BAND}/positions`)
  if ([401, 403].includes(anonRead.res.status)) ok("friend positions require session", String(anonRead.res.status))
  else bad("friend positions require session", String(anonRead.res.status))

  const anonWrite = await json(`/api/friends/bands/${BAND}/positions`, {
    method: "POST",
    body: JSON.stringify({ sessionId: randomUUID(), points: [{ lat: 11.18, lng: -60.73, accuracy: 10, capturedAt: new Date().toISOString() }] }),
  })
  if ([401, 403].includes(anonWrite.res.status)) ok("friend write requires session", String(anonWrite.res.status))
  else bad("friend write requires session", String(anonWrite.res.status))

  // A device-token route must reject a forged bearer token, and must not be
  // reachable by relying on the session cookie alone.
  const forgedDevice = await json("/api/friends/positions", {
    method: "POST",
    headers: { Authorization: "Bearer not-a-real-token" },
    body: JSON.stringify({ sessionId: randomUUID(), points: [] }),
  })
  if (forgedDevice.res.status === 401) ok("native ingest rejects a forged device token")
  else bad("native ingest rejects a forged device token", String(forgedDevice.res.status))

  const sessionAsDevice = await json("/api/friends/positions", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ sessionId: randomUUID(), points: [] }),
  })
  if (sessionAsDevice.res.status === 401) ok("native ingest does not accept a session cookie")
  else bad("native ingest does not accept a session cookie", String(sessionAsDevice.res.status))

  await assertFriendPrivacy({}, "anonymous")
  await assertFriendPrivacy(auth, "crew")

  // Friend data must never surface on the public surface. The shapes are
  // asserted rather than the coordinates, because we cannot know them.
  const publicTracker = await json(`/api/public/bands/${BAND}/tracker`)
  const trackerKeys = Object.keys(publicTracker.data ?? {})
  const truckKeys = Object.keys(publicTracker.data?.truck ?? {})
  const rogueKey = [...trackerKeys, ...truckKeys].find((key) => /friend|connection|session|device/i.test(key))
  if (trackerKeys.length && !rogueKey) ok("public tracker carries no friend data", Object.keys(publicTracker.data).join(","))
  else bad("public tracker carries no friend data", rogueKey ?? JSON.stringify(trackerKeys))

  const contentFriends = await json(`/api/public/bands/${BAND}/content/friends`)
  if ([403, 404].includes(contentFriends.res.status)) ok("friend data not served as public content", String(contentFriends.res.status))
  else bad("friend data not served as public content", String(contentFriends.res.status))

  // ---------------------------------------------------------------------
  // Optional end-to-end round trip. Off by default because it creates a
  // connection and a position on the target environment.
  // ---------------------------------------------------------------------
  if (ROUNDTRIP) {
    if (!second.email || !second.password) {
      bad("friend round trip", "set LIVE_SECOND_EMAIL and LIVE_SECOND_PASSWORD")
    } else if (band.data?.band?.liveModules?.includes("friends")) {
      const secondLogin = await json("/api/auth/login", { method: "POST", body: JSON.stringify(second) })
      const secondCookie = sessionCookie(secondLogin.res)
      if (secondLogin.res.status !== 200 || !secondCookie) {
        bad("friend round trip: second sign-in", `${secondLogin.res.status}`)
      } else {
        const invite = await json(`/api/friends/bands/${BAND}/invites`, { method: "POST", headers: auth, body: "{}" })
        const token = invite.data?.invite?.token
        if (invite.res.status !== 200 || !token) bad("friend round trip: invite", JSON.stringify(invite.data))
        else {
          const accepted = await json(`/api/friends/invites/${token}/accept`, { method: "POST", headers: { Cookie: secondCookie }, body: "{}" })
          if (accepted.res.status === 200) ok("friend round trip: invite accepted on the deployed stack")
          else bad("friend round trip: invite accepted on the deployed stack", `${accepted.res.status} ${JSON.stringify(accepted.data)}`)

          const started = await json(`/api/friends/bands/${BAND}/sharing`, { method: "POST", headers: { Cookie: secondCookie }, body: "{}" })
          const sessionId = started.data?.sharing?.sessionId
          if (started.res.status === 200 && sessionId) ok("friend round trip: sharing started")
          else bad("friend round trip: sharing started", JSON.stringify(started.data))

          const wrote = await json(`/api/friends/bands/${BAND}/positions`, {
            method: "POST",
            headers: { Cookie: secondCookie },
            body: JSON.stringify({ sessionId, points: [{ lat: 11.1811, lng: -60.7333, accuracy: 8, capturedAt: new Date().toISOString() }] }),
          })
          if (wrote.res.status === 200 && wrote.data?.accepted === 1) ok("friend round trip: browser position stored")
          else bad("friend round trip: browser position stored", `${wrote.res.status} ${JSON.stringify(wrote.data)}`)

          const seen = await json(`/api/friends/bands/${BAND}`, { headers: auth })
          const visible = (seen.data?.friends ?? []).find((friend) => friend.position)
          if (visible) ok("friend round trip: connection sees the position", `source ${visible.position.source}, ${visible.freshness}`)
          else bad("friend round trip: connection sees the position", JSON.stringify(seen.data?.friends))

          await json(`/api/friends/bands/${BAND}/sharing`, { method: "DELETE", headers: { Cookie: secondCookie } })
          const afterStop = await json(`/api/friends/bands/${BAND}`, { headers: auth })
          const still = (afterStop.data?.friends ?? []).find((friend) => friend.position)
          if (!still) ok("friend round trip: stopping sharing removes the position")
          else bad("friend round trip: stopping sharing removes the position", JSON.stringify(still))
        }
      }
    } else {
      ok("friend round trip", "skipped: band is not entitled to friends")
    }
  } else {
    console.log("SKIP friend round trip (set LIVE_FRIENDS_ROUNDTRIP=true to include it)")
  }

  const go = await json(`/api/admin/bands/${BAND}/tracker/go-live`, { method: "POST", headers: auth, body: "{}" })
  const shareId = go.data?.shareId
  if (go.res.status === 200 && shareId) ok("go live")
  else bad("go live", JSON.stringify(go.data))

  const pos = await json(`/api/admin/bands/${BAND}/tracker/position`, { method: "POST", headers: auth, body: JSON.stringify({ shareId, lat: 11.182, lng: -60.735, accuracy: 10, heading: 90 }) })
  if (pos.res.status === 200) ok("phone position")
  else bad("phone position", `${pos.res.status} ${JSON.stringify(pos.data)}`)

  const liveSnap = await json(`/api/public/bands/${BAND}/tracker`)
  const truck = liveSnap.data?.truck
  if (truck?.publicLive && truck.position?.source === "phone_fallback" && truck.position.lat && truck.status === "live") ok("public pin from marshal phone")
  else bad("public pin from marshal phone", JSON.stringify(truck))

  const delayed = await json(`/api/admin/bands/${BAND}/tracker/delayed`, { method: "POST", headers: auth, body: JSON.stringify({ message: "Water stop — assurance check" }) })
  if (delayed.res.status === 200) ok("delay published")
  else bad("delay published", JSON.stringify(delayed.data))
  const delayedSnap = await json(`/api/public/bands/${BAND}/tracker`)
  if (delayedSnap.data?.truck?.status === "delayed" && delayedSnap.data.truck.message.includes("Water stop")) ok("patron sees delay")
  else bad("patron sees delay", JSON.stringify(delayedSnap.data?.truck))

  const end = await json(`/api/admin/bands/${BAND}/tracker/end-live`, { method: "POST", headers: auth, body: "{}" })
  if (end.res.status === 200) ok("end live")
  else bad("end live", JSON.stringify(end.data))
  const after = await json(`/api/public/bands/${BAND}/tracker`)
  if (after.data?.truck?.position === null && after.data.truck.status === "not-live") ok("pin hidden after end live")
  else bad("pin hidden after end live", JSON.stringify(after.data?.truck))

  const late = await json(`/api/admin/bands/${BAND}/tracker/position`, { method: "POST", headers: auth, body: JSON.stringify({ shareId, lat: 11.19, lng: -60.74, accuracy: 10, heading: null }) })
  if (late.res.status === 409) ok("stale share rejected")
  else bad("stale share rejected", String(late.res.status))

  const logout = await json("/api/auth/logout", { method: "POST", headers: auth, body: "{}" })
  if (logout.res.status === 200) ok("logout")
  else bad("logout", String(logout.res.status))
  const afterLogout = await json(`/api/admin/bands/${BAND}/tracker`, { headers: auth })
  if (afterLogout.res.status === 401) ok("revoked cookie rejected")
  else bad("revoked cookie rejected", String(afterLogout.res.status))

  const plat = await json("/api/auth/login", { method: "POST", body: JSON.stringify(platform) })
  const platCookie = sessionCookie(plat.res)
  if (plat.res.status === 200 && plat.data?.user?.platformRole === "platform_admin") ok("platform login")
  else bad("platform login", JSON.stringify(plat.data?.user))
  const bands = await json("/api/platform/bands?limit=20", { headers: { Cookie: platCookie } })
  if (bands.res.status === 200 && Array.isArray(bands.data?.bands)) ok("platform bands", String(bands.data.bands.length))
  else bad("platform bands", `${bands.res.status}`)
  await json("/api/auth/logout", { method: "POST", headers: { Cookie: platCookie }, body: "{}" })

  const forgot = await json("/api/auth/forgot", { method: "POST", body: JSON.stringify({ email: crew.email }) })
  if (forgot.res.status === 200 && forgot.data?.ok) ok("forgot password accepted")
  else bad("forgot password accepted", `${forgot.res.status}`)
  const unknownForgot = await json("/api/auth/forgot", { method: "POST", body: JSON.stringify({ email: "nobody@example.invalid" }) })
  if (unknownForgot.res.status === 200 && unknownForgot.data?.ok) ok("forgot does not reveal accounts")
  else bad("forgot does not reveal accounts", String(unknownForgot.res.status))

  const browser = await chromium.launch()
  const patron = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const crewCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    geolocation: { latitude: 11.182, longitude: -60.735, accuracy: 10 },
    permissions: ["geolocation"],
  })
  const view = await patron.newPage()
  const admin = await crewCtx.newPage()
  view.setDefaultTimeout(20000)
  admin.setDefaultTimeout(20000)

  // `domcontentloaded` rather than `networkidle`: the tracker page loads map
  // tiles continuously, so the network is never idle and the wait can hang.
  await view.goto(origin, { waitUntil: "domcontentloaded" })
  await view.getByRole("heading", { name: "Find the truck" }).waitFor()
  if (view.url().includes(`/${BAND}`) && !view.url().includes("github.io")) ok(`home lands on ${BAND}`)
  else bad(`home lands on ${BAND}`, view.url())
  if (await view.getByText("Prototype build").count() === 0) ok("no prototype chip")
  else bad("no prototype chip", "visible")

  // Wait for the tracker card to actually render before judging it. Switching
  // to `domcontentloaded` means the page is interactive before its data lands,
  // so asserting immediately would race the fetch rather than test the UI.
  const truckName = before.data?.truck?.name
  let statusCard = false
  try {
    if (truckName) await view.getByRole("heading", { name: new RegExp(truckName, "i") }).first().waitFor({ timeout: 20000 })
    const card = await view.locator("main").innerText()
    statusCard = /Not on the road yet/i.test(card)
  } catch { statusCard = false }
  if (statusCard) ok("status card not live")
  else bad("status card not live", await view.locator("h1,h2").allTextContents().then((t) => t.join(" | ")))

  // Tab content is asserted against what the API actually returns, rather than
  // against fixed copy, so this stays correct for any band's real content.
  const updateTitle = updates.data?.content?.[0]?.title
  if (updateTitle) {
    await view.getByRole("link", { name: "Updates" }).click()
    try {
      await view.getByText(updateTitle, { exact: false }).first().waitFor({ timeout: 15000 })
      ok("updates tab shows the published update", updateTitle)
    } catch { bad("updates tab shows the published update", `"${updateTitle}" never appeared`) }
  } else bad("updates tab shows the published update", "no update title from the API")

  const guideTitle = guide.data?.content?.title
  if (guideTitle) {
    await view.getByRole("link", { name: "Guide" }).click()
    try {
      await view.getByText(guideTitle, { exact: false }).first().waitFor({ timeout: 15000 })
      ok("guide tab shows the published guide", guideTitle)
    } catch { bad("guide tab shows the published guide", `"${guideTitle}" never appeared`) }
  } else bad("guide tab shows the published guide", "no guide title from the API")

  // Photos is entitled on this band but not deployed, so it must read as an
  // upsell or a clearly-labelled preview rather than pretending uploads work.
  // Asserted semantically because the rendering differs by brand: a band with
  // its own artwork shows a gallery labelled as a preview, others show upsell
  // copy. What must never appear is an upload control, and the page must say
  // that uploads are not available yet.
  await view.getByRole("link", { name: "Photos" }).click()
  await view.waitForTimeout(1500)
  const photosText = await view.locator("main").innerText()
  const uploadControls = await view.locator("main input[type='file']").count()
  const honest = /preview collection|uploads? coming soon|hasn’t turned|hasn't turned|coming online|plan includes/i.test(photosText)
  if (uploadControls === 0 && honest) ok("photos is an honest upsell or labelled preview, no upload affordance")
  else bad("photos is an honest upsell or labelled preview, no upload affordance", `file inputs ${uploadControls}, honest copy ${honest}`)

  await admin.goto(`${origin}/${BAND}/admin`, { waitUntil: "domcontentloaded" })
  await admin.getByRole("heading", { name: "Sign in" }).waitFor()
  if (await admin.getByRole("button", { name: "Tobago ID coming soon" }).isDisabled()) ok("Tobago ID disabled")
  else bad("Tobago ID disabled", "enabled or missing")
  await admin.getByLabel("Email", { exact: true }).fill(crew.email)
  await admin.getByLabel("Password", { exact: true }).fill(crew.password)
  await admin.getByRole("button", { name: "Sign in", exact: true }).click()
  await admin.getByRole("heading", { name: "Take the truck live" }).waitFor()
  ok("crew reaches admin")

  await admin.getByRole("button", { name: "Go live", exact: true }).click()
  await admin.getByRole("button", { name: "Send location once" }).click()
  await admin.getByText("Last sent at", { exact: false }).waitFor()
  await view.getByRole("link", { name: "Tracker" }).click()
  await view.getByText("Updated from a marshal’s phone", { exact: false }).waitFor()
  ok("patron sees marshal phone pin")
  await admin.getByRole("button", { name: "End live", exact: true }).click()
  await view.getByRole("heading", { name: /Not on the road yet/ }).waitFor()
  if (await view.getByText("Updated from a marshal’s phone", { exact: false }).count() === 0) ok("end live hides pin in UI")
  else bad("end live hides pin in UI", "pin copy still visible")
  await admin.getByRole("button", { name: "End live and log out" }).click()
  await admin.getByRole("heading", { name: "Sign in", exact: true }).waitFor()
  ok("logout returns to sign in")

  await view.screenshot({ path: "/tmp/live-tracker-mobile.png", fullPage: true })
  await browser.close()
} catch (error) {
  bad("uncaught", error.stack || String(error))
  try {
    await json("/api/auth/login", { method: "POST", body: JSON.stringify(crew) }).then(async login => {
      const cookie = sessionCookie(login.res)
      if (cookie) await json(`/api/admin/bands/${BAND}/tracker/end-live`, { method: "POST", headers: { Cookie: cookie }, body: "{}" })
    })
  } catch { /* cleanup best-effort */ }
}

const idle = await json(`/api/public/bands/${BAND}/tracker`)
if (idle.data?.truck?.status === "not-live" && idle.data.truck.position === null) ok("demo left not-live")
else bad("demo left not-live", JSON.stringify(idle.data?.truck))

console.log(`\n${pass.length} passed, ${fail.length} failed`)
writeFileSync("/tmp/live-assurance.json", JSON.stringify({ origin, band: BAND, pass, fail }, null, 2))
if (fail.length) process.exit(1)
