import { chromium } from "@playwright/test"

/**
 * Crawl a deployed site and report every link that does not resolve.
 *
 *   LIVE_ORIGIN=https://windies-truck-tracker.web.app LIVE_BAND_SLUG=fog-angels node scripts/link-audit.mjs
 *
 * Checks two different things, because they fail differently:
 *
 *  1. **Every route renders.** A route can return 200 and still be a dead end if
 *     the app draws its not-found or error state, so each page is loaded in a
 *     real browser and its body inspected for those states.
 *  2. **Every link resolves.** Anchors are collected from the rendered DOM, not
 *     from the source, so links that only appear after data loads are included.
 *
 * This is the check for "no dead links or paths", and it is worth running after
 * any route, nav, or entitlement change.
 */
const origin = process.env.LIVE_ORIGIN ?? "https://windies-truck-tracker.web.app"
const BAND = process.env.LIVE_BAND_SLUG ?? "fog-angels"

const routes = [
  "/",
  `/${BAND}`,
  `/${BAND}/updates`,
  `/${BAND}/guide`,
  `/${BAND}/photos`,
  `/${BAND}/library`,
  `/${BAND}/friends`,
  `/${BAND}/friends?invite=${"a".repeat(64)}`,
  `/${BAND}/account`,
  `/${BAND}/admin`,
  `/${BAND}/upsell/photos`,
  `/${BAND}/upsell/friends`,
  "/privacy",
  "/login",
  "/register",
  "/forgot",
  "/reset?token=" + "b".repeat(64),
]

/** Text that means the app rendered a failure state rather than real content. */
const DEAD_STATES = [
  /could not|can't|cannot load/i,
  /something went wrong/i,
  /band unavailable/i,
  /not found/i,
  /service temporarily unavailable/i,
]

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1200, height: 900 } })
const page = await context.newPage()
page.setDefaultTimeout(20000)

const problems = []
const links = new Map()
const seenRoutes = []

for (const route of routes) {
  const url = `${origin}${route}`
  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded" })
    const status = response?.status() ?? 0
    // Let data-driven content land so links inside it are present.
    await page.waitForTimeout(1200)

    const body = await page.locator("body").innerText().catch(() => "")
    const dead = DEAD_STATES.find((pattern) => pattern.test(body))
    const heading = await page.locator("h1").first().innerText().catch(() => "")

    const isUpsell = /coming online|hasn’t turned|add .* to this band/i.test(body)
    seenRoutes.push({ route, status, heading: heading.slice(0, 60), upsell: isUpsell })

    if (status >= 400) problems.push(`${route} returned HTTP ${status}`)
    else if (dead && !isUpsell) problems.push(`${route} rendered a failure state: "${dead}"`)

    for (const href of await page.locator("a[href]").evaluateAll((nodes) => nodes.map((n) => n.getAttribute("href")))) {
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) continue
      const resolved = new URL(href, url)
      if (resolved.origin !== new URL(origin).origin) { links.set(resolved.href, { external: true }); continue }
      const key = resolved.pathname + resolved.search
      if (!links.has(key)) links.set(key, { external: false })
    }
  } catch (error) {
    problems.push(`${route} failed to load: ${error.message.split("\n")[0]}`)
  }
}

// Every internal destination the UI actually offers.
for (const [key, meta] of links) {
  if (meta.external) continue
  try {
    const response = await page.goto(`${origin}${key}`, { waitUntil: "domcontentloaded" })
    const status = response?.status() ?? 0
    if (status >= 400) problems.push(`link ${key} returned HTTP ${status}`)
  } catch (error) {
    problems.push(`link ${key} failed: ${error.message.split("\n")[0]}`)
  }
}

await browser.close()

console.log("Routes checked:")
for (const entry of seenRoutes) {
  console.log(`  ${entry.status}  ${entry.route}${entry.upsell ? "  [upsell]" : ""}  ${entry.heading}`)
}
const internal = [...links.entries()].filter(([, m]) => !m.external)
const external = [...links.entries()].filter(([, m]) => m.external)
console.log(`\nLinked destinations: ${internal.length} internal, ${external.length} external`)
for (const [href] of external) console.log(`  external: ${href}`)
console.log(`\n${problems.length ? "PROBLEMS" : "No dead links or failure states found."}`)
for (const problem of problems) console.log(`  - ${problem}`)
if (problems.length) process.exit(1)
