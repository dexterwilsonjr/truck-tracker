import { cleanupExpiredAuth } from "./auth/rate-limit.ts"
import { sweepFriendIngestRows } from "./modules/friends/privacy.ts"

const INTERVAL_MS = 60_000

/**
 * Periodic housekeeping, run once per service instance.
 *
 * Everything here used to run inline on a request: expired-row cleanup on every
 * sign-in, and the friend sweep on every position write. That made both paths
 * cost several queries more than the work they were doing, and it scaled with
 * request volume rather than with time. At a hundred phones sharing every eight
 * seconds, the sweep alone was fifty DELETE statements a second.
 *
 * `unref` keeps the timer from holding the process open on shutdown.
 */
export function startMaintenance(): () => void {
  let running = false
  const tick = async () => {
    // A slow sweep must not stack up behind itself.
    if (running) return
    running = true
    try {
      await sweepFriendIngestRows()
      await cleanupExpiredAuth()
    } catch (error) {
      console.error("Maintenance pass failed", { type: error instanceof Error ? error.name : "unknown" })
    } finally {
      running = false
    }
  }
  const timer = setInterval(() => void tick(), INTERVAL_MS)
  timer.unref()
  void tick()
  return () => clearInterval(timer)
}
