import { useDemo } from "@/state/demo-context"
import { Icon } from "@/components/ui/Icon"

/**
 * Schematic "map" for the prototype.
 *
 * REPLACE ME with a real map when GPS goes live: swap the body of this
 * component for a MapLibre / Google Maps / Leaflet view, feed it the truck's
 * real coordinates from the tracking service, and keep the marker legend
 * below. No simulated position here is ever presented as a real truck
 * location — see the persistent "Demo map" notice.
 */
export function MapPanel() {
  const { snapshot } = useDemo()
  const truck = snapshot.truck

  return (
    <div
      role="img"
      aria-label={`Schematic demo map showing ${truck.truckName} and the meet-up point. Not a real map or location.`}
      className="relative aspect-[5/4] w-full overflow-hidden sm:aspect-[16/9] lg:aspect-[21/10]"
    >
      {/* Decorative base: grid + glow, clearly not a real basemap */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 20% 10%, color-mix(in srgb, var(--color-panel) 95%, transparent), var(--color-night)), color-mix(in srgb, var(--color-panel) 60%, var(--color-night))",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.55]"
        style={{
          backgroundImage:
            "linear-gradient(to right, color-mix(in srgb, var(--color-sky) 7%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--color-sky) 7%, transparent) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />

      {/* Coastline sweep (bottom right) */}
      <svg
        aria-hidden="true"
        viewBox="0 0 400 260"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <path
          d="M320 -10 C 300 40, 360 90, 330 140 C 305 182, 350 225, 330 270 L 410 270 L 410 -10 Z"
          fill="color-mix(in srgb, var(--color-teal) 13%, transparent)"
        />
        <path
          d="M318 10 C 300 55, 358 95, 328 145 C 304 184, 345 224, 328 258"
          fill="none"
          stroke="color-mix(in srgb, var(--color-teal) 45%, transparent)"
          strokeWidth="1.5"
          strokeDasharray="2 5"
        />
      </svg>

      {/* Route: truck -> meet point (schematic only) */}
      <svg
        aria-hidden="true"
        viewBox="0 0 400 260"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <path
          d="M 205 168 C 235 140, 240 120, 278 108"
          fill="none"
          stroke="color-mix(in srgb, var(--color-gold) 80%, transparent)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="1 10"
        />
      </svg>

      {/* Markers */}
      <Marker
        tone="gold"
        label={truck.truckName}
        className="left-[52%] top-[62%]"
      />
      <Marker
        tone="teal"
        label="Meet point"
        className="left-[70%] top-[41%]"
      />

      {/* Legend */}
      <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full border border-line bg-night/75 px-3 py-1.5 backdrop-blur-sm">
        <LegendSwatch tone="gold" label={truck.truckName} />
        <LegendSwatch tone="teal" label="Meet point" />
      </div>

      {/* North + demo notice */}
      <div className="absolute right-3 top-3 grid size-8 place-items-center rounded-full border border-line bg-night/75 text-[11px] font-bold text-faint backdrop-blur-sm">
        N
      </div>

      <p className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-gradient-to-t from-night/85 to-transparent px-4 pb-3 pt-8 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
        Demo map — not a real location
      </p>
    </div>
  )
}

function LegendSwatch({
  tone,
  label,
}: {
  tone: "gold" | "teal"
  label: string
}) {
  const color = tone === "gold" ? "var(--color-gold)" : "var(--color-teal)"
  return (
    <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
      <span
        aria-hidden="true"
        className="size-2 rounded-full"
        style={{ background: color }}
      />
      {label}
    </span>
  )
}

function Marker({
  tone,
  label,
  className,
}: {
  tone: "gold" | "teal"
  label: string
  className: string
}) {
  const color = tone === "gold" ? "var(--color-gold)" : "var(--color-teal)"
  return (
    <div className={`absolute ${className} -translate-x-1/2`}>
      <div
        aria-hidden="true"
        className="absolute -bottom-1 left-1/2 size-6 -translate-x-1/2 rounded-full opacity-40 motion-safe:animate-pulse-dot"
        style={{ background: `color-mix(in srgb, ${color} 55%, transparent)` }}
      />
      <div
        className="relative flex -translate-y-full flex-col items-center"
        style={{ color }}
      >
        <Icon name="map-pin" className="size-8 drop-shadow-lg" strokeWidth={2} />
        <span
          aria-hidden="true"
          className="absolute top-5 h-0 w-0 border-x-[7px] border-t-[10px] border-x-transparent"
          style={{ borderTopColor: color }}
        />
        <span
          className="relative mt-7 rounded-full border px-2 py-0.5 text-[10px] font-bold whitespace-nowrap text-night backdrop-blur-sm"
          style={{ background: color, borderColor: color }}
        >
          {label}
        </span>
      </div>
    </div>
  )
}
