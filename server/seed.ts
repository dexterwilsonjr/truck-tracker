import "dotenv/config"
import { migrate, sql } from "./db.ts"
import { loadEnv } from "./env.ts"
import { hashPassword } from "./auth/passwords.ts"

const env = loadEnv()
await migrate()

const passwordHash = await hashPassword(env.platformAdminPassword)
await sql`
  INSERT INTO users (email, password_hash, name, platform_role)
  VALUES (
    ${env.platformAdminEmail},
    ${passwordHash},
    'Platform admin',
    'platform_admin'
  )
  ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    platform_role = 'platform_admin'
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
  ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash
  RETURNING id
`

const bands = await sql<{ id: string }[]>`
  INSERT INTO bands (slug, name, event_year, event_label, tagline, brand)
  VALUES (
    ${env.seedBandSlug},
    ${env.seedBandName},
    2026,
    'J''ouvert & Pretty Mas',
    'Find the truck. Catch the vibe.',
    ${sql.json({
      productName: "Truck Tracker",
      palette: {
        night: "#070b15",
        gold: "#eab84c",
        goldink: "#221703",
        teal: "#31d6bd",
      },
    })}
  )
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`

const bandId = bands[0]?.id
const organizerId = organizer[0]?.id
if (bandId && organizerId) {
  await sql`
    INSERT INTO band_members (band_id, user_id, role)
    VALUES (${bandId}::uuid, ${organizerId}::uuid, 'organizer')
    ON CONFLICT (band_id, user_id) DO NOTHING
  `
}

console.log("Seeded:")
console.log(`  platform  ${env.platformAdminEmail} / ${env.platformAdminPassword}`)
console.log(`  organizer  ${env.seedOrganizerEmail} / ${env.seedOrganizerPassword}`)
console.log(`  band      /${env.seedBandSlug}`)

await sql.end({ timeout: 5 })
