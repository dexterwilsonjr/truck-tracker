import "dotenv/config"
import { migrate, sql } from "./db.ts"
import { loadEnv } from "./env.ts"
import { hashPassword } from "./auth/passwords.ts"
import { clientById } from "../src/config/clients.ts"
import { brandPayload } from "../src/config/brands/payload.ts"
import { INCLUDED_PACKAGES } from "./modules/deployed.ts"

const env = loadEnv()
for (const password of [env.platformAdminPassword, env.seedOrganizerPassword]) {
  if (password.length < 12 || /changeme/i.test(password)) throw new Error("Set unique seed passwords of at least 12 characters before seeding")
}
await migrate()

const client = clientById(env.seedBrand) ?? clientById("original")!
const pack = client.brand
const presentation = pack.presentation
const slug = env.seedBrand === "original" ? env.seedBandSlug : presentation.slug
const name = env.seedBrand === "original" ? env.seedBandName : presentation.name

const passwordHash = await hashPassword(env.platformAdminPassword)
await sql`
  INSERT INTO users (email, password_hash, name, platform_role)
  VALUES (
    ${env.platformAdminEmail},
    ${passwordHash},
    'Platform admin',
    'platform_admin'
  )
  ON CONFLICT (email) DO NOTHING
`

const organizerHash = await hashPassword(env.seedOrganizerPassword)
const organizer = await sql<{ id: string }[]>`
  INSERT INTO users (email, password_hash, name, platform_role)
  VALUES (
    ${env.seedOrganizerEmail},
    ${organizerHash},
    'Band organizer',
    'patron'
  )
  ON CONFLICT (email) DO NOTHING
  RETURNING id
`

const bands = await sql<{ id: string }[]>`
  INSERT INTO bands (slug, name, event_year, event_label, tagline, brand)
  VALUES (
    ${slug},
    ${name},
    ${presentation.eventYear},
    ${presentation.eventLabel},
    ${presentation.tagline},
    ${sql.json(brandPayload(pack))}
  )
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`

const bandId = bands[0]?.id
const organizerId = organizer[0]?.id ?? (await sql<{ id: string }[]>`SELECT id FROM users WHERE email = ${env.seedOrganizerEmail}`)[0]?.id
if (bandId && organizerId) {
  await sql`
    INSERT INTO band_members (band_id, user_id, role)
    VALUES (${bandId}::uuid, ${organizerId}::uuid, 'organizer')
    ON CONFLICT (band_id, user_id) DO NOTHING
  `
}

if (bandId) {
  await sql`
    INSERT INTO trucks (band_id, name, meetup_lat, meetup_lng, meetup_label)
    VALUES (${bandId}::uuid, ${presentation.truckName}, ${presentation.meetup.lat}, ${presentation.meetup.lng}, ${presentation.meetup.label})
    ON CONFLICT (band_id) DO NOTHING
  `
  for (const code of INCLUDED_PACKAGES) {
    await sql`INSERT INTO band_entitlements (band_id, module_code) VALUES (${bandId}::uuid, ${code}) ON CONFLICT (band_id, module_code) DO NOTHING`
  }
  await sql`INSERT INTO band_content (band_id, updates, guide) VALUES (${bandId}::uuid, ${sql.json(presentation.updates)}, ${sql.json(presentation.guide)}) ON CONFLICT (band_id) DO NOTHING`
}
console.info("Seed complete. Existing credentials and band content were preserved.")
await sql.end({ timeout: 5 })
