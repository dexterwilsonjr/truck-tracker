import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import postgres from "postgres"

import { loadEnv } from "./env.ts"

const env = loadEnv()

export const sql = postgres(env.databaseUrl, { max: 10, prepare: false, connect_timeout: 10, idle_timeout: 20, onnotice: () => {} })

export async function migrate(): Promise<void> {
  const file = join(dirname(fileURLToPath(import.meta.url)), "schema.sql")
  const text = readFileSync(file, "utf8")
  await sql.begin(async tx => {
    await tx`SELECT pg_advisory_xact_lock(128712)`
    await tx.unsafe(text)
  })
}
