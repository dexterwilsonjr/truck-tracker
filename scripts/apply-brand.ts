import "dotenv/config"
import postgres from "postgres"

import { CLIENTS, clientById } from "../src/config/clients.ts"
import { brandPayload } from "../src/config/brands/payload.ts"
import { INCLUDED_PACKAGES } from "../server/modules/deployed.ts"

/**
 * Provision or refresh one client band.
 *
 *   npm run brand -- <clientId>
 *
 * Idempotent: the band slug is the stable key, so re-running updates the
 * existing row rather than creating a second band. Safe to run before every
 * event or app build.
 */
const id = process.argv[2] ?? ""
const client = clientById(id)
if (!client) {
  console.error("Usage: npm run brand -- <clientId>")
  console.error(`Registered clients: ${Object.keys(CLIENTS).join(", ")}`)
  process.exit(1)
}

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error("DATABASE_URL is required")
  process.exit(1)
}

const sql = postgres(databaseUrl, {
  max: 1,
  prepare: false,
  connect_timeout: 20,
  ssl: /supabase|neon\.tech|sslmode=require/i.test(databaseUrl) ? "require" : undefined,
})

const p = client.brand.presentation
const packed = brandPayload(client.brand)

await sql.begin(async (tx) => {
  const existing = await tx<{ id: string }[]>`
    SELECT id FROM bands WHERE slug = ${p.slug}
  `
  const bandId = existing[0]?.id
    ? (await tx<{ id: string }[]>`
        UPDATE bands SET
          name = ${p.name},
          event_year = ${p.eventYear},
          event_label = ${p.eventLabel},
          tagline = ${p.tagline},
          brand = ${tx.json(packed)}
        WHERE id = ${existing[0].id}::uuid
        RETURNING id
      `)[0]!.id
    : (await tx<{ id: string }[]>`
        INSERT INTO bands (slug, name, event_year, event_label, tagline, brand)
        VALUES (${p.slug}, ${p.name}, ${p.eventYear}, ${p.eventLabel}, ${p.tagline}, ${tx.json(packed)})
        RETURNING id
      `)[0]!.id

  await tx`
    INSERT INTO trucks (band_id, name, meetup_lat, meetup_lng, meetup_label)
    VALUES (${bandId}::uuid, ${p.truckName}, ${p.meetup.lat}, ${p.meetup.lng}, ${p.meetup.label})
    ON CONFLICT (band_id) DO UPDATE SET
      name = EXCLUDED.name,
      meetup_lat = EXCLUDED.meetup_lat,
      meetup_lng = EXCLUDED.meetup_lng,
      meetup_label = EXCLUDED.meetup_label
  `

  // Entitlements follow the deployed package set, so shipping a new module
  // grants it here without a second list to keep in sync.
  for (const code of INCLUDED_PACKAGES) {
    await tx`
      INSERT INTO band_entitlements (band_id, module_code)
      VALUES (${bandId}::uuid, ${code})
      ON CONFLICT (band_id, module_code) DO UPDATE SET status = 'active', starts_at = now(), ends_at = null
    `
  }

  await tx`
    INSERT INTO band_content (band_id, updates, guide)
    VALUES (${bandId}::uuid, ${tx.json(p.updates)}, ${tx.json(p.guide)})
    ON CONFLICT (band_id) DO UPDATE SET updates = EXCLUDED.updates, guide = EXCLUDED.guide, updated_at = now()
  `
})

await sql.end({ timeout: 5 })
console.info(`Applied ${client.id} presentation (${p.slug}).`)
console.info(`Native build: appName="${client.appName}" appId="${client.appId}" VITE_BRAND=${client.id}`)
