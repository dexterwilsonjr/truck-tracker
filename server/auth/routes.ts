import { Hono } from "hono"
import type { Context } from "hono"
import { HTTPException } from "hono/http-exception"
import { sql } from "../db.ts"
import type { AppEnv } from "../env.ts"
import { body, email, string } from "../validation.ts"
import { sendMail } from "./mailer.ts"
import { hashPassword, randomToken, sha256, verifyPassword } from "./passwords.ts"
import { clearSessionCookie, readSessionUserId, setSessionCookie, revokeSession } from "./session.ts"
import { rateLimit } from "./rate-limit.ts"
import { revokeLocationAccess } from "../modules/friends/privacy.ts"
export type PlatformRole = "patron" | "platform_admin"
export type BandMemberRole = "organizer" | "marshal"
export interface SessionUser {
  id: string; email: string; name: string; platformRole: PlatformRole
  bandRoles: { bandId: string; slug: string; role: BandMemberRole }[]
  mustResetPassword: boolean
}
export type AuthVariables = { env: AppEnv; user: SessionUser | null }
export const auth = new Hono<{ Variables: AuthVariables }>()
const dummyHash = await hashPassword(randomToken())

async function signIn(c: Context<{ Variables: AuthVariables }>, id: string, expectedHash?: string) {
  await revokeSession(c, c.get("env"))
  await setSessionCookie(c, c.get("env"), id, expectedHash)
  return c.json({ user: await loadSessionUser(id) })
}
auth.post("/register", async c => {
  const data = await body(c)
  const address = email(data.email)
  const password = string(data.password, "Password", 12, 128)
  const name = string(data.name ?? "", "Name", 0, 100).trim()
  await rateLimit(c, "register", address, 5)
  const hash = await hashPassword(password)
  const rows = await sql<{ id: string }[]>`INSERT INTO users (email, password_hash, name)
    VALUES (${address}, ${hash}, ${name}) ON CONFLICT (email) DO NOTHING RETURNING id`
  if (!rows[0]) throw new HTTPException(409, { message: "That email already has an account." })
  return signIn(c, rows[0].id, hash)
})
auth.post("/login", async c => {
  const data = await body(c)
  const address = email(data.email)
  const password = string(data.password, "Password", 1, 128)
  await rateLimit(c, "login", address)
  const rows = await sql<{ id: string; password_hash: string }[]>`SELECT id, password_hash FROM users WHERE email = ${address}`
  const row = rows[0]
  const valid = await verifyPassword(password, row?.password_hash ?? dummyHash)
  if (!row || !valid) throw new HTTPException(401, { message: "Email or password is wrong." })
  return signIn(c, row.id, row.password_hash)
})
auth.post("/logout", async c => {
  const userId = await readSessionUserId(c, c.get("env"))
  await revokeSession(c, c.get("env"))
  // Logging out must withdraw location access, not just stop the app polling:
  // it ends sharing, deletes the stored position, and revokes device tokens.
  // Without this the last position would stay visible to friends for the whole
  // freshness window, and an enrolled phone could keep posting.
  if (userId) await revokeLocationAccess(userId)
  return c.json({ ok: true })
})
auth.get("/me", async c => {
  const id = await readSessionUserId(c, c.get("env"))
  return c.json({ user: id ? await loadSessionUser(id) : null })
})
auth.post("/forgot", async c => {
  const data = await body(c)
  const address = email(data.email)
  try { await rateLimit(c, "forgot", address, 5) } catch (error) {
    if (error instanceof HTTPException && error.status === 429) return c.json({ ok: true })
    throw error
  }
  const rows = await sql<{ id: string }[]>`SELECT id FROM users WHERE email = ${address}`
  if (rows[0]) {
    const token = randomToken()
    await sql`INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
      VALUES (${rows[0].id}::uuid, ${sha256(token)}, now() + interval '1 hour')`
    try {
      await sendMail(c.get("env"), { to: address, subject: "Reset your Truck Tracker password",
        text: `Set a new password within one hour: ${c.get("env").frontendOrigin}/reset?token=${token}` })
    } catch {
      // Preserve the same public response whether the account exists or not.
      console.error("Password recovery delivery failed")
    }
  }
  return c.json({ ok: true })
})
auth.post("/reset", async c => {
  const data = await body(c)
  const token = string(data.token, "Reset token", 64, 64)
  const password = string(data.password, "Password", 12, 128)
  await rateLimit(c, "reset", sha256(token))
  const hash = await hashPassword(password)
  const id = await sql.begin(async tx => {
    // Lock the user before tokens, so different tokens for one user serialize.
    const users = await tx<{ id: string }[]>`SELECT u.id FROM users u
      JOIN password_reset_tokens t ON t.user_id = u.id
      WHERE t.token_hash = ${sha256(token)} FOR UPDATE OF u`
    if (!users[0]) throw new HTTPException(400, { message: "That reset link is expired or already used." })
    const used = await tx<{ user_id: string }[]>`UPDATE password_reset_tokens SET used_at = now()
      WHERE token_hash = ${sha256(token)} AND used_at IS NULL AND expires_at > now() RETURNING user_id`
    if (!used[0]) throw new HTTPException(400, { message: "That reset link is expired or already used." })
    const userId = used[0].user_id
    await tx`UPDATE users SET password_hash = ${hash}, must_reset_password = false WHERE id = ${userId}::uuid`
    await tx`UPDATE password_reset_tokens SET used_at = now() WHERE user_id = ${userId}::uuid AND used_at IS NULL`
    await tx`DELETE FROM sessions WHERE user_id = ${userId}::uuid`
    return userId
  })
  // A password reset is a security event: withdraw location access entirely.
  await revokeLocationAccess(id)
  return signIn(c, id, hash)
})
auth.post("/change-password", async c => {
  const user = await requireUser(c)
  if (user instanceof Response) return user
  const data = await body(c)
  const old = string(data.currentPassword, "Current password", 1, 128)
  const password = string(data.password, "New password", 12, 128)
  if (old === password) throw new HTTPException(400, { message: "Choose a different password." })
  await rateLimit(c, "change-password", user.id)
  const hash = await hashPassword(password)
  await sql.begin(async tx => {
    const rows = await tx<{ password_hash: string }[]>`SELECT password_hash FROM users WHERE id = ${user.id}::uuid FOR UPDATE`
    if (!rows[0] || !await verifyPassword(old, rows[0].password_hash)) throw new HTTPException(401, { message: "Current password is wrong." })
    await tx`UPDATE users SET password_hash = ${hash}, must_reset_password = false WHERE id = ${user.id}::uuid`
    await tx`DELETE FROM sessions WHERE user_id = ${user.id}::uuid`
    await tx`UPDATE password_reset_tokens SET used_at = now() WHERE user_id = ${user.id}::uuid AND used_at IS NULL`
  })
  await revokeLocationAccess(user.id)
  return signIn(c, user.id, hash)
})

export async function loadSessionUser(
  userId: string,
): Promise<SessionUser | null> {
  const users = await sql<
    {
      id: string
      email: string
      name: string
      platform_role: PlatformRole
      must_reset_password: boolean
    }[]
  >`
    SELECT id, email, name, platform_role, must_reset_password
    FROM users WHERE id = ${userId}::uuid
  `
  const user = users[0]
  if (!user) return null
  const members = await sql<
    { band_id: string; slug: string; role: BandMemberRole }[]
  >`
    SELECT bm.band_id, b.slug, bm.role
    FROM band_members bm
    JOIN bands b ON b.id = bm.band_id
    WHERE bm.user_id = ${user.id}::uuid
  `
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    platformRole: user.platform_role,
    bandRoles: members.map((m) => ({
      bandId: m.band_id,
      slug: m.slug,
      role: m.role,
    })),
    mustResetPassword: user.must_reset_password,
  }
}

export async function requireUser(
  c: Context<{ Variables: AuthVariables }>,
): Promise<SessionUser | Response> {
  const env = c.get("env")
  const userId = await readSessionUserId(c, env)
  if (!userId) {
    return c.json(
      { error: { code: "unauthenticated", message: "Sign in to continue." } },
      401,
    )
  }
  const user = await loadSessionUser(userId)
  if (!user) {
    clearSessionCookie(c, env)
    return c.json(
      { error: { code: "unauthenticated", message: "Sign in to continue." } },
      401,
    )
  }
  if (user.mustResetPassword && !c.req.path.endsWith("/auth/change-password")) {
    return c.json({ error: { code: "password_change_required", message: "Change your temporary password to continue." } }, 403)
  }
  c.set("user", user)
  return user
}

export function isOrganizerFor(user: SessionUser, bandId: string): boolean {
  if (user.platformRole === "platform_admin") return true
  return user.bandRoles.some(
    (m) => m.bandId === bandId && (m.role === "organizer" || m.role === "marshal"),
  )
}

export function isBandOrganizer(user: SessionUser, bandId: string): boolean {
  if (user.platformRole === "platform_admin") return true
  return user.bandRoles.some((m) => m.bandId === bandId && m.role === "organizer")
}
