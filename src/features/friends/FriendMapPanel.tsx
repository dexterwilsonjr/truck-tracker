import { useEffect, useRef, useState } from "react"
import "maplibre-gl/dist/maplibre-gl.css"

import { createBasemap, maplibregl } from "@/components/map/basemap"
import { Icon } from "@/components/ui/Icon"
import { brand } from "@/config/brand"
import type { FriendPin } from "./live-types"

/** Scarborough, Tobago — the reference point when nobody has a known position yet. */
const DEFAULT_CENTER: [number, number] = [-60.735, 11.182]

const MARKER_COLOR: Record<FriendPin["freshness"], string> = {
  live: brand.palette.teal,
  stationary: brand.palette.sky,
  stale: brand.palette.faint,
}

const FRESHNESS_LABEL: Record<FriendPin["freshness"], string> = {
  live: "Live",
  stationary: "Stationary",
  stale: "Not recent",
}

export function FriendMapPanel({
  pins,
  me,
}: {
  pins: FriendPin[]
  me: { lat: number; lng: number } | null
}) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  // Markers are keyed by person so a moving friend is repositioned rather than
  // torn down and recreated on every poll.
  const markers = useRef(new Map<string, maplibregl.Marker>())
  const centered = useRef(false)
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!container.current) return
    const basemap = createBasemap({
      container: container.current,
      center: DEFAULT_CENTER,
      zoom: 12,
      onReady: () => { setReady(true); setFailed(false) },
      onFail: () => setFailed(true),
    })
    if (!basemap) { setFailed(true); return }
    map.current = basemap.map
    const markerMap = markers.current
    return () => {
      basemap.destroy()
      map.current = null
      markerMap.clear()
    }
  }, [])

  useEffect(() => {
    const instance = map.current
    if (!instance) return
    const live = new Set<string>()

    for (const pin of pins) {
      live.add(pin.userId)
      const label = `${pin.name || "Friend"} · ${FRESHNESS_LABEL[pin.freshness]}`
      const existing = markers.current.get(pin.userId)
      if (existing) {
        existing.setLngLat([pin.position.lng, pin.position.lat])
        existing.setPopup(new maplibregl.Popup().setText(label))
        continue
      }
      markers.current.set(
        pin.userId,
        new maplibregl.Marker({ color: MARKER_COLOR[pin.freshness] })
          .setLngLat([pin.position.lng, pin.position.lat])
          .setPopup(new maplibregl.Popup().setText(label))
          .addTo(instance),
      )
    }

    // A friend who stopped sharing, or whose fix went stale enough to withhold,
    // must disappear from the map rather than linger as a ghost pin.
    for (const [userId, marker] of markers.current) {
      if (!live.has(userId)) {
        marker.remove()
        markers.current.delete(userId)
      }
    }
  }, [pins])

  // Recentre once, on the first position we ever get, so the map does not jump
  // around underneath the user on every poll.
  useEffect(() => {
    const instance = map.current
    if (!instance || centered.current) return
    const focus = me ?? (pins[0] ? { lat: pins[0].position.lat, lng: pins[0].position.lng } : null)
    if (!focus) return
    centered.current = true
    instance.flyTo({ center: [focus.lng, focus.lat], zoom: 14, essential: false })
  }, [me, pins])

  const hasPins = pins.length > 0

  return (
    <div className="overflow-hidden rounded-card border border-line bg-panel">
      <div className="relative">
        <div ref={container} role="img" aria-label="Friends map" className="h-[min(38svh,320px)] min-h-[280px] w-full sm:h-[420px]" />
        {!ready && !failed && (
          <div className="pointer-events-none absolute inset-x-4 bottom-8 rounded-xl border border-line bg-panel/95 px-4 py-3 text-center text-sm text-muted" role="status">
            Opening the map…
          </div>
        )}
      </div>
      {failed && (
        <p className="p-4 text-sm" role="alert">
          The map could not fully load. Your friends’ sharing status is still listed below.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line px-4 py-3 text-xs text-muted" aria-label="Map legend">
        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-teal" />Moving</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-sky" />Stationary</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-faint" />Not recent</span>
        {me && <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#66aaff]" />You</span>}
        <button
          type="button"
          disabled={!hasPins && !me}
          onClick={() => {
            const focus = me ?? (pins[0] ? { lat: pins[0].position.lat, lng: pins[0].position.lng } : null)
            if (focus) map.current?.flyTo({ center: [focus.lng, focus.lat], zoom: 14 })
          }}
          className="-my-2 ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 font-semibold text-gold disabled:opacity-50"
        >
          <Icon name="gps" className="size-4" />Recenter
        </button>
      </div>
    </div>
  )
}
