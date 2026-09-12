/**
 * Freshness and input rules for friend positions.
 *
 * Kept pure and separate from the routes so the boundaries are unit-testable,
 * the same way `truck_tracker/snapshot.ts` separates the truck rules.
 *
 * The truck uses a flat 30-second window. Friend sharing cannot: a native SDK
 * reduces GPS activity while the phone is still, so a 30-second rule would
 * report a stationary friend as lost. Freshness is therefore motion-aware, and
 * the UI is expected to say "stationary, last reported ..." rather than pretend
 * a still person is live.
 */

/** A moving friend should report at least this often. */
export const MOVING_FRESH_MS = 120_000
/** A stationary friend legitimately reports far less often. */
export const STATIONARY_FRESH_MS = 20 * 60_000
/**
 * A browser tab stops reporting the instant it is hidden, backgrounded, or the
 * phone locks, and nothing tells us that happened. A browser fix is therefore
 * trusted only briefly, so a closed tab makes a pin disappear instead of
 * leaving a stale one behind.
 */
export const BROWSER_FRESH_MS = 90_000
/** Past this, the shared position is withheld entirely rather than shown stale. */
export const ABANDON_MS = 45 * 60_000
/** Tolerance for device clocks running ahead of the server. */
export const CLOCK_SKEW_MS = 5 * 60_000
/** Matches the `accuracy_m` CHECK in the schema, which stays as a backstop. */
export const MAX_ACCURACY_M = 200
/** One batch is bounded so a device cannot post an unbounded array. */
export const MAX_BATCH_POINTS = 200

export type MotionState = "moving" | "stationary" | "unknown"
export type Freshness = "live" | "stationary" | "stale" | "abandoned"

/**
 * Where a fix came from.
 *
 * The two writers have genuinely different reliability, so the API accepts both
 * and records which one produced a point. That keeps the browser honest today
 * and makes the native app a drop-in second writer rather than a rewrite.
 */
export type PositionSource = "browser" | "native"

export interface Fix {
  lat: number
  lng: number
  accuracy_m: number
  heading: number | null
  motion_state: MotionState
  source: PositionSource
  captured_at: Date | string
}

/**
 * How a stored fix should be presented, given how it was produced.
 *
 * Browser and native cannot share a rule. A native SDK keeps reporting while
 * the phone is pocketed and deliberately slows down when still, so freshness is
 * motion-aware. A browser cannot report in the background at all, so a fix is
 * either very recent or not trustworthy, and motion is not reported.
 */
export function fixFreshness(fix: Fix, now = Date.now()): Freshness {
  const age = now - +new Date(fix.captured_at)
  if (fix.source === "browser") return age <= BROWSER_FRESH_MS ? "live" : "abandoned"
  if (age > ABANDON_MS) return "abandoned"
  if (fix.motion_state === "stationary") {
    return age <= STATIONARY_FRESH_MS ? "stationary" : "stale"
  }
  return age <= MOVING_FRESH_MS ? "live" : "stale"
}

export interface IncomingPoint {
  lat: number
  lng: number
  accuracy: number
  heading: number | null
  motion: MotionState
  capturedAt: string
  locationUuid: string | null
}

export type SanitizeResult =
  | { ok: true; point: IncomingPoint }
  | { ok: false; reason: string }

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

/**
 * Validate one point from a device or a browser.
 *
 * Rejects rather than throws, and clamps accuracy rather than refusing the
 * record: a single bad fix in a queued batch must not fail the whole batch, and
 * out-of-range accuracy is a reporting artefact, not a reason to drop a real
 * position. Out-of-range coordinates are rejected because they are nonsense.
 *
 * The same rules apply to both sources, so a browser point and a native point
 * are interchangeable once stored.
 */
export function sanitizePoint(raw: unknown, now = Date.now(), source: PositionSource = "native"): SanitizeResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, reason: "not_an_object" }
  }
  const input = raw as Record<string, unknown>

  const lat = finiteNumber(input.lat)
  const lng = finiteNumber(input.lng)
  if (lat === null || lng === null) return { ok: false, reason: "missing_coordinates" }
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return { ok: false, reason: "coordinates_out_of_range" }
  if (lat === 0 && lng === 0) return { ok: false, reason: "null_island" }

  const rawAccuracy = finiteNumber(input.accuracy)
  if (rawAccuracy === null || rawAccuracy < 0) return { ok: false, reason: "invalid_accuracy" }
  const accuracy = Math.min(rawAccuracy, MAX_ACCURACY_M)

  // Heading is only meaningful for a moving fix. Teltonika reports it in tenths
  // of a degree; the SDK and the browser report degrees. Anything outside a full
  // turn is untrustworthy, so drop it rather than wrap.
  const rawHeading = finiteNumber(input.heading)
  const heading = rawHeading !== null && rawHeading >= 0 && rawHeading < 360 ? rawHeading : null

  // Motion is only recorded when a real location engine reported it. A browser
  // value would be a client-side guess from successive fixes, so it is stored as
  // unknown rather than presented as fact to friends.
  const motion =
    source === "native" && (input.motion === "moving" || input.motion === "stationary")
      ? input.motion
      : "unknown"

  let capturedAt: string
  if (typeof input.capturedAt === "string" && input.capturedAt.length <= 40) {
    const parsed = new Date(input.capturedAt)
    if (Number.isNaN(parsed.getTime())) return { ok: false, reason: "invalid_captured_at" }
    if (parsed.getTime() - now > CLOCK_SKEW_MS) return { ok: false, reason: "captured_in_future" }
    capturedAt = parsed.toISOString()
  } else {
    return { ok: false, reason: "missing_captured_at" }
  }

  const locationUuid =
    typeof input.locationUuid === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.locationUuid)
      ? input.locationUuid
      : null

  return { ok: true, point: { lat, lng, accuracy, heading, motion, capturedAt, locationUuid } }
}
