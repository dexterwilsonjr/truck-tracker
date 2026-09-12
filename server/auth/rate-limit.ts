import type { Context } from "hono"
import { HTTPException } from "hono/http-exception"
import { sql } from "../db.ts"
import { sha256 } from "./passwords.ts"

/**
 * Total volume allowed for one scope across the whole platform, per window.
 * A backstop against runaway abuse rather than a per-user control.
 */
const GLOBAL_LIMIT = 1000
const WINDOW = "15 minutes"

/**
 * Fixed-window rate limiting.
 *
 * Three buckets exist, and which ones apply genuinely matters:
 *
 * - **global** caps total volume for a scope, platform-wide.
 * - **account** caps one email or user id. This is the bucket that resists
 *   credential stuffing, and it always applies.
 * - **client** caps one source address, and is **off by default**. Behind
 *   Firebase Hosting into Cloud Run the request arrives from Google's own
 *   proxy, so the peer address is shared by every user of the platform. A client
 *   bucket keyed on it is not a per-source limit at all: it becomes a second,
 *   much smaller global bucket that throttles everybody. That is exactly how a
 *   crowd of people signing in at once used to lock itself out. Only pass
 *   `{ client: true }` once a trustworthy address is available.
 *
 * Cleanup of expired rows is deliberately not done here. This runs on every
 * sign-in and registration, and three DELETEs per call is real load for no
 * benefit; `startMaintenance()` handles it on a timer instead.
 */
export async function rateLimit(
  c: Context,
  scope: string,
  account = "",
  limit = 20,
  options: { client?: boolean } = {},
): Promise<void> {
  const buckets: readonly (readonly [string, number])[] = options.client
    ? [[`${scope}:global`, GLOBAL_LIMIT], [`${scope}:account:${account}`, limit], [`${scope}:client:${clientAddress(c)}`, limit * 5]]
    : [[`${scope}:global`, GLOBAL_LIMIT], [`${scope}:account:${account}`, limit]]

  for (const [key, max] of buckets) {
    const rows = await sql<{ hits: number }[]>`INSERT INTO rate_limits (key, hits, expires_at)
      VALUES (${sha256(key)}, 1, now() + interval '${sql.unsafe(WINDOW)}')
      ON CONFLICT (key) DO UPDATE SET
        hits = CASE WHEN rate_limits.expires_at <= now() THEN 1 ELSE rate_limits.hits + 1 END,
        expires_at = CASE WHEN rate_limits.expires_at <= now() THEN now() + interval '${sql.unsafe(WINDOW)}' ELSE rate_limits.expires_at END
      RETURNING hits`
    if ((rows[0]?.hits ?? 0) > max) {
      c.header("Retry-After", "900")
      throw new HTTPException(429, { message: "Too many attempts. Please try again in 15 minutes." })
    }
  }
}

/** The nearest proxy in the chain. Shared between users, hence off by default. */
export function clientAddress(c: Context): string {
  return c.req.header("x-forwarded-for")?.split(",").at(-1)?.trim() ?? "unknown"
}

/** Clear expired counters, sessions and reset tokens. Called on a timer. */
export async function cleanupExpiredAuth(): Promise<void> {
  await sql`DELETE FROM rate_limits WHERE expires_at < now() - interval '1 hour'`
  await sql`DELETE FROM sessions WHERE expires_at < now()`
  await sql`DELETE FROM password_reset_tokens WHERE expires_at < now() - interval '1 day'`
}
