import { sql } from "../db.ts"

/**
 * Health and readiness, split because they answer different questions.
 *
 * An uptime check needs to know "is the process alive and is its database
 * reachable". Readiness additionally needs to know "is the database actually
 * usable", which is not the same thing: during the connection-pool deadlock
 * found in this build, connections were open and the pool was exhausted, so a
 * naive `SELECT 1` would have been one more request hanging rather than a
 * failure. Readiness therefore checks for that specific signature and reports
 * unhealthy instead of waiting.
 */

export interface HealthReport {
  ok: boolean
  product: string
  version: string
  /** Milliseconds the database probe took. A sustained rise is an early warning. */
  databaseMs: number
  release: string | null
}

const VERSION = "1.2.0"

/** How long a single health probe may take before it counts as a failure. */
const PROBE_TIMEOUT_MS = 4_000

async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("probe_timeout")), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * Liveness: is this instance able to answer, and can it reach the database.
 * Deliberately cheap, because a platform uptime check calls it every minute.
 */
export async function liveness(): Promise<HealthReport> {
  const started = Date.now()
  try {
    await withTimeout(sql`SELECT 1`, PROBE_TIMEOUT_MS)
    return {
      ok: true,
      product: "truck-tracker",
      version: VERSION,
      databaseMs: Date.now() - started,
      release: process.env.K_REVISION ?? null,
    }
  } catch {
    return {
      ok: false,
      product: "truck-tracker",
      version: VERSION,
      databaseMs: Date.now() - started,
      release: process.env.K_REVISION ?? null,
    }
  }
}

export interface ReadinessReport extends HealthReport {
  /** Connections held by transactions that are idle, which is a leak. */
  idleInTransaction: number
  /** True when the pool is saturated by transactions that are not doing work. */
  poolStarved: boolean
}

/**
 * Readiness: liveness plus a check for the failure mode that took this API down.
 *
 * A transaction that has stopped doing work while still holding its connection
 * is either a bug or a deadlock. Past the pool size, every further request waits
 * behind them and the service stops answering while still appearing to run. That
 * is exactly the state to fail loudly on, because it is invisible from outside.
 */
export async function readiness(): Promise<ReadinessReport> {
  const base = await liveness()
  if (!base.ok) return { ...base, idleInTransaction: 0, poolStarved: false }

  try {
    const rows = await withTimeout(
      sql<{ idle: number; total: number }[]>`
        SELECT
          count(*) FILTER (WHERE state = 'idle in transaction')::int AS idle,
          count(*)::int AS total
        FROM pg_stat_activity
        WHERE datname = current_database() AND pid <> pg_backend_pid()
      `,
      PROBE_TIMEOUT_MS,
    )
    const idle = rows[0]?.idle ?? 0
    const total = rows[0]?.total ?? 0
    // The pool holds ten. Most of it sitting idle in a transaction means
    // requests are queuing behind work that has stopped, so say so.
    const starved = idle >= 5 && total >= 5
    return { ...base, ok: !starved, idleInTransaction: idle, poolStarved: starved }
  } catch {
    // A failed readiness probe is itself a signal, not a reason to claim health.
    return { ...base, ok: false, idleInTransaction: -1, poolStarved: false }
  }
}
