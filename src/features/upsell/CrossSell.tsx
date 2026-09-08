import { Link } from "react-router-dom"

import type { ModuleCode } from "@/config/modules"
import { ALSO_ON_THE_ROAD, MODULE_TITLES, UPSELL_CATALOG } from "@/features/upsell/catalog"
import { bandHref } from "@/lib/paths"
import { demoHref, useDemoBase } from "@/lib/demo-base"
import { useOptionalBand } from "@/state/BandProvider"
import { Icon } from "@/components/ui/Icon"
import type { IconName } from "@/components/ui/Icon"

const ICONS: Record<ModuleCode, IconName> = {
  truck_tracker: "map-pin",
  updates: "megaphone",
  guide: "compass",
  photos: "camera",
  push: "bell",
  face_mapping: "image",
  print: "image",
}

export function CrossSell({
  exclude,
  className = "",
}: {
  exclude?: ModuleCode
  className?: string
}) {
  const band = useOptionalBand()
  const demoBase = useDemoBase()
  const slug = band?.band.slug
  const codes = ALSO_ON_THE_ROAD.filter((code) => code !== exclude)

  return (
    <section className={className} aria-label="More from Truck Tracker">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold">
        Also on the road
      </p>
      <p className="mt-1 text-sm text-muted">More from Truck Tracker</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {codes.map((code) => (
          <li key={code}>
            <Link
              to={
                slug
                  ? bandHref(slug, `/upsell/${code}`)
                  : demoHref(demoBase, `/upsell/${code}`)
              }
              className="flex min-h-14 items-center gap-3 rounded-2xl border border-line bg-panel px-4 py-3 transition hover:bg-white/[0.04]"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gold/12 text-gold">
                <Icon name={ICONS[code]} className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[15px] font-bold">
                  {MODULE_TITLES[code]}
                </span>
                <span className="block truncate text-[12px] text-faint">
                  {UPSELL_CATALOG[code].patron.headline}
                </span>
              </span>
              <Icon name="chevron-right" className="size-4 shrink-0 text-faint" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

export { ICONS as MODULE_ICONS }
