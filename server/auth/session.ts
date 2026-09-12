import { getCookie, setCookie, deleteCookie } from "hono/cookie"
import type { Context } from "hono"
import type { AppEnv } from "../env.ts"
import { HTTPException } from "hono/http-exception"
import { sql } from "../db.ts"
import { randomToken, sha256 } from "./passwords.ts"

const TTL_SECONDS = 60 * 60 * 24 * 14
export async function setSessionCookie(c: Context, env: AppEnv, userId: string, expectedHash?: string): Promise<void> {
  const token = randomToken()
  await sql.begin(async tx => {
    const rows = await tx<{ password_hash: string }[]>`SELECT password_hash FROM users WHERE id = ${userId}::uuid FOR UPDATE`
    if (!rows[0] || (expectedHash !== undefined && expectedHash !== rows[0].password_hash)) throw new HTTPException(401, { message: "Your password changed. Sign in again." })
    await tx`INSERT INTO sessions (token_hash, user_id, expires_at)
      VALUES (${sha256(token)}, ${userId}::uuid, ${new Date(Date.now() + TTL_SECONDS * 1000)})`
  })
  setCookie(c, env.cookieName, token, { httpOnly: true, sameSite: "Lax", path: "/", secure: env.isProd, maxAge: TTL_SECONDS })
}
export function clearSessionCookie(c: Context, env: AppEnv): void {
  deleteCookie(c, env.cookieName, { path: "/", secure: env.isProd, sameSite: "Lax" })
}
export async function revokeSession(c: Context, env: AppEnv): Promise<void> {
  const raw = getCookie(c, env.cookieName)
  if (raw) await sql`DELETE FROM sessions WHERE token_hash = ${sha256(raw)}`
  clearSessionCookie(c, env)
}
export async function readSessionUserId(c: Context, env: AppEnv): Promise<string | null> {
  const raw = getCookie(c, env.cookieName)
  if (!raw || !/^[a-f0-9]{64}$/.test(raw)) return null
  const rows = await sql<{ user_id: string }[]>`SELECT user_id FROM sessions WHERE token_hash = ${sha256(raw)} AND expires_at > now()`
  return rows[0]?.user_id ?? null
}
