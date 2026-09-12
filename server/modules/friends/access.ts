import { sql } from "../../db.ts"

export type ConnectionStatus = "accepted" | "blocked" | "removed"

export interface ConnectionRow {
  id: string
  band_id: string
  requester_id: string
  addressee_id: string
  status: ConnectionStatus
  blocked_by: string | null
}

/**
 * The single authorization question for friend location data: may `actorId`
 * see `targetId`'s shared position in this band?
 *
 * Only an accepted connection grants visibility. A blocked row therefore denies
 * in both directions, which is what makes blocking absolute: the block kills the
 * connection rather than adding a second, separately-bypassable check.
 *
 * Call this before disclosing any coordinate. Never filter friend positions in
 * the client.
 */
export async function maySeePosition(
  actorId: string,
  targetId: string,
  bandId: string,
): Promise<boolean> {
  if (actorId === targetId) return true
  const rows = await sql<{ ok: number }[]>`
    SELECT 1 AS ok FROM connections
    WHERE band_id = ${bandId}::uuid AND status = 'accepted'
      AND ((requester_id = ${actorId}::uuid AND addressee_id = ${targetId}::uuid)
        OR (requester_id = ${targetId}::uuid AND addressee_id = ${actorId}::uuid))
    LIMIT 1
  `
  return rows.length > 0
}

/** The connection between two people in a band, whatever its state. */
export async function connectionBetween(
  bandId: string,
  aId: string,
  bId: string,
): Promise<ConnectionRow | null> {
  const rows = await sql<ConnectionRow[]>`
    SELECT * FROM connections
    WHERE band_id = ${bandId}::uuid
      AND ((requester_id = ${aId}::uuid AND addressee_id = ${bId}::uuid)
        OR (requester_id = ${bId}::uuid AND addressee_id = ${aId}::uuid))
    LIMIT 1
  `
  return rows[0] ?? null
}

/**
 * True when either person has blocked the other. A blocked pair must never be
 * reconnected, so every invite acceptance checks this first.
 */
export async function isBlockedBetween(
  bandId: string,
  aId: string,
  bId: string,
): Promise<boolean> {
  const rows = await sql<{ ok: number }[]>`
    SELECT 1 AS ok FROM connections
    WHERE band_id = ${bandId}::uuid AND status = 'blocked'
      AND ((requester_id = ${aId}::uuid AND addressee_id = ${bId}::uuid)
        OR (requester_id = ${bId}::uuid AND addressee_id = ${aId}::uuid))
    LIMIT 1
  `
  return rows.length > 0
}
