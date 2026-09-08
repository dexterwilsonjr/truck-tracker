import { createHmac, timingSafeEqual } from "node:crypto"

import { getCookie, setCookie, deleteCookie } from "hono/cookie"
import type { Context } from "hono"

import type { AppEnv } from "../env.ts"

const TTL_SECONDS = 60 * 60 * 24 * 14

export function setSessionCookie(
  c: Context,
  env: AppEnv,
  userId: string,
): void {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS
  const payload = `${userId}.${exp}`
  const sig = sign(env.sessionSecret, payload)
  setCookie(c, env.cookieName, `${payload}.${sig}`, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    secure: env.isProd,
    maxAge: TTL_SECONDS,
  })
}

export function clearSessionCookie(c: Context, env: AppEnv): void {
  deleteCookie(c, env.cookieName, { path: "/" })
}

export function readSessionUserId(c: Context, env: AppEnv): string | null {
  const raw = getCookie(c, env.cookieName)
  if (!raw) return null
  const lastDot = raw.lastIndexOf(".")
  if (lastDot <= 0) return null
  const payload = raw.slice(0, lastDot)
  const sig = raw.slice(lastDot + 1)
  const expected = sign(env.sessionSecret, payload)
  if (!safeEqual(sig, expected)) return null
  const [userId, expRaw] = payload.split(".")
  const exp = Number(expRaw)
  if (!userId || !Number.isFinite(exp) || exp < Date.now() / 1000) return null
  return userId
}

function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex")
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}
