import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"

const scryptAsync = promisify(scrypt)

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const derived = (await scryptAsync(password, salt, 64)) as Buffer
  return `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [algo, saltHex, hashHex] = stored.split(":")
  if (algo !== "scrypt" || !saltHex || !hashHex) return false
  const derived = (await scryptAsync(
    password,
    Buffer.from(saltHex, "hex"),
    64,
  )) as Buffer
  const expected = Buffer.from(hashHex, "hex")
  if (derived.length !== expected.length) return false
  return timingSafeEqual(derived, expected)
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

export function randomToken(): string {
  return randomBytes(32).toString("hex")
}
