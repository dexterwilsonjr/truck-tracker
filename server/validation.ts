import { HTTPException } from "hono/http-exception"
import type { Context } from "hono"

export function invalid(message: string): never {
  throw new HTTPException(400, { message })
}
export async function body(c: Context): Promise<Record<string, unknown>> {
  const value: unknown = await c.req.json().catch(() => invalid("Send a valid JSON request."))
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid("Send a JSON object.")
  return value as Record<string, unknown>
}
export function string(value: unknown, name: string, min = 1, max = 200): string {
  if (typeof value !== "string" || value.length < min || value.length > max) invalid(`${name} must be ${min}–${max} characters.`)
  return value
}
export function email(value: unknown): string {
  const result = string(value, "Email", 3, 254).trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) invalid("Enter a valid email address.")
  return result
}
export function uuid(value: unknown): string {
  const result = string(value, "ID", 36, 36)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(result)) invalid("Invalid ID.")
  return result
}
export function page(value: string | undefined): number {
  const result = Number(value ?? 0)
  if (!Number.isSafeInteger(result) || result < 0 || result > 100000) invalid("Invalid page.")
  return result
}
