import { useEffect, useRef, useState } from "react"
import "maplibre-gl/dist/maplibre-gl.css"
import { createBasemap, maplibregl } from "@/components/map/basemap"
import { brand } from "@/config/brand"
import { Icon } from "@/components/ui/Icon"
import type { LiveTruck } from "./live-types"

export function LiveMapPanel({ truck, location }: { truck: LiveTruck; location: { lat: number; lng: number } | null }) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const pin = useRef<maplibregl.Marker | null>(null)
  const person = useRef<maplibregl.Marker | null>(null)
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)
  const { lat, lng, label } = truck.meetup
  useEffect(() => {
    if (!container.current) return
    const basemap = createBasemap({
      container: container.current,
      center: [lng, lat],
      zoom: 13,
      onReady: () => { setReady(true); setFailed(false) },
      onFail: () => setFailed(true),
    })
    if (!basemap) { setFailed(true); return }
    map.current = basemap.map
    new maplibregl.Marker({ color: brand.palette.teal }).setLngLat([lng, lat]).setPopup(new maplibregl.Popup().setText(label)).addTo(basemap.map)
    return () => { basemap.destroy(); map.current = null; pin.current = null; person.current = null }
  }, [lat, lng, label])
  useEffect(() => {
    if (!map.current) return
    if (!truck.position) { pin.current?.remove(); pin.current = null; return }
    const p = truck.position
    if (!pin.current) pin.current = new maplibregl.Marker({ color: brand.palette.gold }).setPopup(new maplibregl.Popup().setText(truck.name)).setLngLat([p.lng, p.lat]).addTo(map.current)
    else pin.current.setLngLat([p.lng, p.lat])
  }, [truck.position, truck.name])
  useEffect(() => {
    if (!map.current || !location) return
    person.current?.remove()
    person.current = new maplibregl.Marker({ color: "#66aaff" }).setLngLat([location.lng, location.lat]).setPopup(new maplibregl.Popup().setText("You — visible only on this device")).addTo(map.current)
    map.current.flyTo({ center: [location.lng, location.lat], zoom: 14, essential: false })
  }, [location])
  return <div className="overflow-hidden rounded-card border border-line bg-panel">
    <div className="relative">
      <div ref={container} role="img" aria-label="Live truck map" className="h-[min(38svh,320px)] min-h-[280px] w-full sm:h-[440px]" />
      {!ready && !failed && <div className="pointer-events-none absolute inset-x-4 bottom-8 rounded-xl border border-line bg-panel/95 px-4 py-3 text-center text-sm text-muted" role="status">Loading the map…</div>}
    </div>
    {failed && <p className="p-4 text-sm" role="alert">The map could not fully load. Check your connection; the truck status and meeting reference are still available.</p>}
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line px-4 py-3 text-xs text-muted" aria-label="Map legend">
      <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-gold" />Truck</span>
      <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-teal" />Meet-up</span>
      {location && <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#66aaff]" />You</span>}
      <button type="button" onClick={() => { const p = truck.position ?? truck.meetup; map.current?.flyTo({ center: [p.lng, p.lat], zoom: 14 }) }} className="-my-2 ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 font-semibold text-gold"><Icon name="gps" className="size-4" />Recenter</button>
    </div>
  </div>
}
