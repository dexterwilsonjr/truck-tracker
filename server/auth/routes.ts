import { Hono } from "hono"
import type { Context } from "hono"

import { sql } from "../db.ts"
import type { AppEnv } from "../env.ts"
import { sendMail } from "./mailer.ts"
import {
  hashPassword,
  randomToken,
  sha256,
  verifyPassword,
} from "./passwords.ts"
import {
  clearSessionCookie,
  readSessionUserId,
  setSessionCookie,
} from "./session.ts"

const RESET_TTL_MS = 60 * 60 * 1000
const forgotHits = new Map<string, { count: number; windowStart: number }>()

export type PlatformRole = "patron" | "platform_admin"
export type BandMemberRole = "organizer" | "marshal"

export interface SessionUser {
  id: string
  email: string
  name: string
  platformRole: PlatformRole
  bandRoles: { bandId: string; slug: string; role: BandMemberRole }[]
  mustResetPassword: boolean
}

export type AuthVariables = { env: AppEnv; user: SessionUser | null }

export const auth = new Hono<{ Variables: AuthVariables }>()

auth.post("/register", async (c) => {
  const env = c.get("env")
  const body = await c.req.json<{
    email?: string
    password?: string
    name?: string
  }>()
  const email = (body.email ?? "").trim().toLowerCase()
  const password = body.password ?? ""
  const name = (body.name ?? "").trim()
  if (!email || !email.includes("@")) {
    return c.json(
      { error: { code: "invalid_email", message: "Enter a valid email." } },
      400,
    )
  }
  if (password.length < 8) {
    return c.json(
      { error: { code: "weak_password", message: "Use at least 8 characters." } },
      400,
    )
  }
  const existing = await sql<{ id: string }[]>`
    SELECT id FROM users WHERE email = ${email}
  `
  if (existing[0]) {
    return c.json(
      {
        error: {
          code: "email_taken",
          message: "That email already has an account.",
        },
      },
      409,
    )
  }
  const passwordHash = await hashPassword(password)
  const rows = await sql<{ id: string }[]>`
    INSERT INTO users (email, password_hash, name, platform_role)
    VALUES (${email}, ${passwordHash}, ${name}, 'patron')
    RETURNING id
  `
  const userId = rows[0]?.id
  if (!userId) {
    return c.json(
      { error: { code: "register_failed", message: "Could not create account." } },
      500,
    )
  }
  setSessionCookie(c, env, userId)
  const user = await loadSessionUser(userId)
  return c.json({ user })
})

auth.post("/login", async (c) => {
  const env = c.get("env")
  const body = await c.req.json<{ email?: string; password?: string }>()
  const email = (body.email ?? "").trim().toLowerCase()
  const password = body.password ?? ""
  const rows = await sql<
    { id: string; password_hash: string }[]
  >`
    SELECT id, password_hash FROM users WHERE email = ${email}
  `
  const row = rows[0]
  const ok = row ? await verifyPassword(password, row.password_hash) : false
  if (!row || !ok) {
    return c.json(
      {
        error: {
          code: "invalid_credentials",
          message: "Email or password is wrong.",
        },
      },
      401,
    )
  }
  setSessionCookie(c, env, row.id)
  const user = await loadSessionUser(row.id)
  return c.json({ user })
})

auth.post("/logout", (c) => {
  const env = c.get("env")
  clearSessionCookie(c, env)
  return c.json({ ok: true })
})

auth.get("/me", async (c) => {
  const env = c.get("env")
  const userId = readSessionUserId(c, env)
  if (!userId) return c.json({ user: null })
  const user = await loadSessionUser(userId)
  return c.json({ user })
})

auth.post("/forgot", async (c) => {
  const env = c.get("env")
  const body = await c.req.json<{ email?: string }>()
  const email = (body.email ?? "").trim().toLowerCase()
  if (!allowForgot(email)) {
    return c.json({ ok: true })
  }
  const rows = await sql<{ id: string; name: string }[]>`
    SELECT id, name FROM users WHERE email = ${email}
  `
  const row = rows[0]
  if (row) {
    const token = randomToken()
    await sql`
      INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
      VALUES (${row.id}::uuid, ${sha256(token)}, ${new Date(Date.now() + RESET_TTL_MS)})
    `
    const link = `${env.frontendOrigin}/reset?token=${token}`
    await sendMail(env, {
      to: email,
      subject: "Reset your Truck Tracker password",
      text: `Hi${row.name ? ` ${row.name}` : ""},\n\nUse this link within an hour to set a new password:\n${link}\n\nIf you did not ask for this, ignore the email.`,
    })
  }
  return c.json({ ok: true })
})

auth.post("/reset", async (c) => {
  const env = c.get("env")
  const body = await c.req.json<{ token?: string; password?: string }>()
  const token = body.token ?? ""
  const password = body.password ?? ""
  if (password.length < 8) {
    return c.json(
      { error: { code: "weak_password", message: "Use at least 8 characters." } },
      400,
    )
  }
  const tokenHash = sha256(token)
  const rows = await sql<{ id: string; user_id: string }[]>`
    SELECT id, user_id FROM password_reset_tokens
    WHERE token_hash = ${tokenHash}
      AND used_at IS NULL
      AND expires_at > now()
  `
  const row = rows[0]
  if (!row) {
    return c.json(
      {
        error: {
          code: "invalid_token",
          message: "That reset link is expired or already used.",
        },
      },
      400,
    )
  }
  const passwordHash = await hashPassword(password)
  await sql`
    UPDATE users
    SET password_hash = ${passwordHash}, must_reset_password = false
    WHERE id = ${row.user_id}::uuid
  `
  await sql`
    UPDATE password_reset_tokens SET used_at = now() WHERE id = ${row.id}::uuid
  `
  setSessionCookie(c, env, row.user_id)
  const user = await loadSessionUser(row.user_id)
  return c.json({ user })
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
  const userId = readSessionUserId(c, env)
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

function allowForgot(email: string): boolean {
  if (!email) return true
  const now = Date.now()
  const hit = forgotHits.get(email)
  if (!hit || now - hit.windowStart > 15 * 60 * 1000) {
    forgotHits.set(email, { count: 1, windowStart: now })
    return true
  }
  if (hit.count >= 5) return false
  hit.count += 1
  return true
}
