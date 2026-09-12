import { sql } from "../../db.ts"

/**
 * Remove rows that have stopped being useful.
 *
 * Two things grow without bound here: enrolled device tokens after their event
 * has passed, and positions whose sharing session has ended, expired, or been
 * revoked. Called from ingest rather than from a reader, so the read path stays
 * a single query and an expired token stops working even if nobody opens a map.
 *
 * Deleting an orphaned position is the same privacy rule as stopping sharing:
 * once the session behind it is gone, the coordinate has no one entitled to it.
 */
export async function sweepFriendIngestRows(): Promise<void> {
  await sql`DELETE FROM devices WHERE expires_at < now() - interval '30 days'`
  await sql`
    DELETE FROM friend_positions fp
    WHERE NOT EXISTS (
      SELECT 1 FROM share_sessions ss
      WHERE ss.id = fp.session_id
        AND ss.ended_at IS NULL AND ss.revoked_at IS NULL AND ss.ends_at > now()
    )
  `
  await sql`DELETE FROM share_sessions WHERE (ended_at IS NOT NULL OR revoked_at IS NOT NULL) AND ends_at < now() - interval '7 days'`
  await sql`DELETE FROM friend_invites WHERE expires_at < now() - interval '30 days'`
}

/**
 * Withdraw a person's ability to be located at all.
 *
 * Called when access ends rather than when the feature is used: logging out,
 * resetting a password, or changing a password. It does three things, and the
 * third is the one that is easy to forget:
 *
 *  1. ends every open sharing session,
 *  2. deletes the stored position, so friends lose sight of them immediately
 *     instead of after the freshness window,
 *  3. revokes every enrolled device token, so a phone that was signed out, or
 *     an install someone walked away from, cannot post again.
 *
 * Without (3) a token issued to a phone that no longer has a signed-in user
 * stays valid for the life of the event.
 *
 * Lives here rather than in the routes because it is a privacy action used by
 * the auth routes, and a module that depends on nothing but the database lets
 * them use it without an import cycle back through `friends/index.ts`.
 */
export async function revokeLocationAccess(userId: string): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`
      UPDATE share_sessions SET ended_at = now()
      WHERE user_id = ${userId}::uuid AND ended_at IS NULL AND revoked_at IS NULL
    `
    await tx`DELETE FROM friend_positions WHERE user_id = ${userId}::uuid`
    await tx`
      UPDATE devices SET active = false, revoked_at = now()
      WHERE user_id = ${userId}::uuid AND active AND revoked_at IS NULL
    `
  })
}
