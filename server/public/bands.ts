import { Hono } from "hono"

import { sql } from "../db.ts"
import { entitledModules, liveModules, comingOnline } from "../entitlements/index.ts"
import { MODULE_CODES } from "../modules/codes.ts"
import { DEPLOYED_PACKAGES } from "../modules/deployed.ts"
import type { AuthVariables } from "../auth/routes.ts"
import { UPSELL_CATALOG } from "./upsell-catalog.ts"

export const publicApi = new Hono<{ Variables: AuthVariables }>()

publicApi.get("/bands", async (c) => {
  const rows = await sql<{ slug: string; name: string; event_year: number }[]>`
    SELECT slug, name, event_year FROM bands ORDER BY name
  `
  return c.json({ bands: rows })
})

publicApi.get("/bands/:slug", async (c) => {
  const slug = c.req.param("slug")
  const rows = await sql<
    {
      id: string
      slug: string
      name: string
      event_year: number
      event_label: string
      tagline: string
      brand: Record<string, unknown>
    }[]
  >`
    SELECT id, slug, name, event_year, event_label, tagline, brand
    FROM bands WHERE slug = ${slug}
  `
  const band = rows[0]
  if (!band) {
    return c.json(
      { error: { code: "band_not_found", message: "That band is not on Truck Tracker." } },
      404,
    )
  }
  const entitled = await entitledModules(band.id)
  const live = liveModules(entitled)
  const coming = comingOnline(entitled)
  return c.json({
    band: {
      id: band.id,
      slug: band.slug,
      name: band.name,
      eventYear: band.event_year,
      eventLabel: band.event_label,
      tagline: band.tagline,
      brand: band.brand,
      entitlements: entitled,
      deployedPackages: [...DEPLOYED_PACKAGES],
      liveModules: live,
      comingOnline: coming,
      upsells: UPSELL_CATALOG,
      catalog: MODULE_CODES,
    },
  })
})
