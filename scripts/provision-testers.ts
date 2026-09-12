import "dotenv/config"
import postgres from "postgres"

import { hashPassword } from "../server/auth/passwords.ts"
import { clientById } from "../src/config/clients.ts"

/**
 * Create a batch of test accounts for one band.
 *
 *   TESTER_PASSWORD='<at least 12 chars>' npm run provision-testers -- fog-angels 100
 *
 * Why a script rather than letting people register: `rateLimit` allows only a
 * small number of registrations per window, and behind Firebase Hosting the
 * client bucket is keyed on Google's own proxy address, so it is shared by
 * everyone. A hundred people registering at once cannot work, and typing
 * passwords outdoors is a poor experience anyway.
 *
 * Accounts are plain patrons. They need no band membership to use friend
 * sharing, and pairing still happens by QR inside the app, so the invite flow
 * stays under test.
 *
 * Idempotent: re-running keeps existing accounts, and their passwords, as they
 * are, so a handout sheet does not silently stop working.
 *
 * Credentials are printed to stdout and never written to a file, so they do not
 * end up in the repository or in a build artefact.
 */

const clientId = process.argv[2] ?? ""
const count = Number(process.argv[3] ?? "0")
const client = clientById(clientId)
if (!client || !Number.isSafeInteger(count) || count < 1 || count > 1000) {
  console.error("Usage: [TESTER_PASSWORD=...] npm run provision-testers -- <clientId> <count>")
  console.error("Registered clients are listed in src/config/clients.ts.")
  process.exit(1)
}

/** Fixed width so the handout sheet sorts and reads cleanly. */
const width = String(count).length

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error("DATABASE_URL is required")
  process.exit(1)
}
const database = new URL(databaseUrl)
// One clear rule for both cases: a database whose name does not end in _test
// needs an explicit confirmation. That covers a local development database and
// the deliberate production run for a real tester cohort, and it means neither
// can happen by accident.
const isTestDatabase = database.pathname.endsWith("_test")
if (!isTestDatabase && process.env.ALLOW_PRODUCTION_TESTERS !== "true") {
  console.error(`Refusing to provision accounts in "${database.pathname}" because it does not look like a test database.`)
  console.error(`To confirm you mean ${database.hostname}${database.pathname}, set ALLOW_PRODUCTION_TESTERS=true.`)
  process.exit(1)
}
if (!isTestDatabase) {
  console.error(`WARNING: provisioning real accounts in ${database.hostname}${database.pathname}.`)
}

const password = process.env.TESTER_PASSWORD ?? ""
if (password.length < 12) {
  console.error("Set TESTER_PASSWORD to at least 12 characters.")
  process.exit(1)
}

const sql = postgres(databaseUrl, {
  max: 1,
  prepare: false,
  connect_timeout: 20,
  ssl: /supabase|neon\.tech|sslmode=require/i.test(databaseUrl) ? "require" : undefined,
})

const domain = process.env.TESTER_EMAIL_DOMAIN ?? `${client.brand.bandSlug}.test`
const band = await sql<{ id: string }[]>`SELECT id FROM bands WHERE slug = ${client.brand.presentation.slug}`
if (!band[0]) {
  console.error(`Band ${client.brand.presentation.slug} does not exist. Run: npm run brand -- ${clientId}`)
  await sql.end({ timeout: 5 })
  process.exit(1)
}

/** One place that decides an address, so the loop and the summary cannot disagree. */
const emailFor = (index: number) => `tester${String(index).padStart(width, "0")}@${domain}`

// One hash, reused. These are throwaway accounts on a test band, and hashing
// a hundred times would make the script needlessly slow.
const hash = await hashPassword(password)
const created: string[] = []
const existing: string[] = []

for (let i = 1; i <= count; i++) {
  const email = emailFor(i)
  const rows = await sql<{ id: string }[]>`
    INSERT INTO users (email, password_hash, name, platform_role)
    VALUES (${email}, ${hash}, ${`Tester ${String(i).padStart(width, "0")}`}, 'patron')
    ON CONFLICT (email) DO NOTHING
    RETURNING id
  `
  if (rows[0]) created.push(email)
  else existing.push(email)
}

await sql.end({ timeout: 5 })

console.log(`Band: ${client.brand.presentation.slug}`)
console.log(`Created ${created.length}, already present ${existing.length}, total ${count}.`)
console.log(`Password: ${password}`)
console.log(`First email: ${emailFor(1)}`)
console.log(`Last email:  ${emailFor(count)}`)
if (existing.length) {
  console.log(`Note: ${existing.length} account(s) already existed. Their passwords were left unchanged, so confirm your handout sheet matches.`)
}
console.log("Credentials are printed here only and are not written to disk.")
