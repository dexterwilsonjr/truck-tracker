import { lazy, Suspense, useEffect, useState } from "react"
import { brand } from "@/config/brand"
import { useBand } from "@/state/band-context"
import { api } from "@/services/api"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Primitives"
import { Icon } from "@/components/ui/Icon"
import type { LiveTruck } from "./live-types"
const LiveMapPanel = lazy(() => import("./LiveMapPanel").then(m => ({ default: m.LiveMapPanel })))

export function LiveTrackerScreen() {
  const { band } = useBand()
  const [truck, setTruck] = useState<LiveTruck | null>(null)
  const [error, setError] = useState("")
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationError, setLocationError] = useState("")
  const [locating, setLocating] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let stopped = false, failures = 0, generation = 0
    let timer: ReturnType<typeof setTimeout>
    let controller: AbortController | null = null
    async function poll() {
      if (stopped || document.hidden) return
      const requestGeneration = ++generation
      controller = new AbortController()
      try {
        const data = await api<{ truck: LiveTruck }>(`/public/bands/${band.slug}/tracker`, { signal: controller.signal })
        if (stopped || document.hidden || requestGeneration !== generation) return
        setTruck(data.truck); setError(""); failures = 0
      } catch {
        if (stopped || document.hidden || requestGeneration !== generation) return
        setTruck(prev => prev ? { ...prev, position: null } : null)
        setError("Connection interrupted. The truck pin is hidden until we can check that sharing is still live.")
        failures++
      }
      if (!stopped && !document.hidden) timer = setTimeout(() => void poll(), Math.min(30000, 5000 * 2 ** failures))
    }
    function visibility() {
      generation++; clearTimeout(timer); controller?.abort()
      if (document.hidden) setTruck(prev => prev ? { ...prev, position: null } : null)
      else void poll()
    }
    function offline() {
      generation++; clearTimeout(timer); controller?.abort()
      setTruck(prev => prev ? { ...prev, position: null } : null)
      setError("You’re offline. The truck pin is hidden until the connection returns.")
    }
    document.addEventListener("visibilitychange", visibility)
    window.addEventListener("offline", offline)
    window.addEventListener("online", visibility)
    void poll()
    return () => { stopped = true; clearTimeout(timer); controller?.abort(); document.removeEventListener("visibilitychange", visibility); window.removeEventListener("offline", offline); window.removeEventListener("online", visibility) }
  }, [band.slug, retry])
  function locate() {
    if (!navigator.geolocation) { setLocationError("Location is not available in this browser."); return }
    setLocating(true); setLocationError("")
    navigator.geolocation.getCurrentPosition(p => { setLocation({ lat: p.coords.latitude, lng: p.coords.longitude }); setLocating(false) }, () => {
      setLocating(false); setLocationError("Location was unavailable. Allow location in your browser settings, or use the meeting reference on the map.")
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
  }
  const age = truck?.position ? Math.max(0, Math.floor((Date.parse(truck.serverTime) - Date.parse(truck.position.recordedAt)) / 1000)) : null
  const status = truck?.status === "not-live" ? "Not on the road yet" : truck?.status === "delayed" ? "Delayed" : truck?.status === "signal-lost" ? "Signal lost" : "Live"
  const distance = location && truck?.position ? haversine(location, truck.position) : null
  const tone = error ? "text-warn" : truck?.status === "live" ? "text-live" : truck?.status === "delayed" || truck?.status === "signal-lost" ? "text-warn" : "text-muted"
  return (
    <div className="space-y-5">
      <header className="relative isolate overflow-hidden rounded-3xl border border-gold/20 bg-panel px-5 py-6 sm:px-7 sm:py-8">
        {brand.visuals?.heroSrc && <>
          <img src={brand.visuals.heroSrc} alt="" fetchPriority="high" className="absolute inset-0 -z-10 h-full w-full object-cover object-[75%_40%] opacity-60" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-panel via-panel/85 to-panel/10" />
        </>}
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">{brand.kicker || band.name}</p>
        <h1 className="mt-2 font-display text-[30px] font-bold leading-tight tracking-tight sm:text-4xl">{brand.heroTitle}</h1>
        <p className="mt-2 max-w-[240px] text-sm leading-relaxed text-muted sm:max-w-md">{band.tagline || brand.tagline}</p>
      </header>

      {error && <Card className="flex flex-wrap items-center justify-between gap-3 border-warn/30 p-4"><p role="alert" className="max-w-2xl text-sm leading-relaxed">{error}</p><Button onClick={() => setRetry(r => r + 1)} variant="secondary">Try again</Button></Card>}

      {truck ? (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section className="min-w-0 space-y-4" aria-label="Truck location">
            <div className="flex items-start gap-3 px-1" aria-live={truck.status === "delayed" ? "assertive" : "polite"}>
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-gold/20 bg-gold/10 text-gold"><Icon name="truck" className="size-5" /></span>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold leading-snug sm:text-lg">{truck.name}<span className="sr-only"> · {status}</span></h2>
                <p className={`mt-1 flex items-center gap-2 text-xs font-medium ${tone}`}><span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{error ? "Checking connection" : status}</p>
              </div>
              {age !== null && <span className="shrink-0 pt-1 text-xs tabular-nums text-muted">{age < 60 ? `${age}s ago` : `${Math.floor(age / 60)}m ago`}</span>}
            </div>
            <Suspense fallback={<div className="grid h-[340px] place-items-center rounded-card border border-line bg-panel text-sm text-muted">Opening map…</div>}><LiveMapPanel truck={truck} location={location} /></Suspense>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button size="lg" busy={locating} fullWidth onClick={locate} icon={<Icon name="gps" className="size-5" />}>Show my location</Button>
              <Button size="lg" fullWidth variant="secondary" to={`/${band.slug}/guide`} icon={<Icon name="calendar" className="size-5" />}>Meeting details</Button>
            </div>
            <p className="flex items-center justify-center gap-1.5 text-xs text-muted"><Icon name="lock" className="size-3.5" />Your location stays on this device.</p>
            {locationError && <p role="alert" className="rounded-2xl border border-warn/30 bg-panel p-4 text-sm leading-relaxed">{locationError}</p>}
            {distance !== null && <p className="rounded-2xl border border-line bg-panel p-4 text-sm">About <strong className="text-gold">{distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`}</strong> away in a straight line.</p>}
          </section>

          <aside className="space-y-4" aria-label="On the road information">
            <Card className="p-5">
              <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-gold"><Icon name="megaphone" className="size-4" />From the crew</p>
              <p className="mt-3 text-sm leading-relaxed">{truck.publicLive ? truck.message || "Follow your marshals on the road." : "The crew hasn’t started sharing yet. The truck pin will appear here when they go live."}</p>
              {age !== null && <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-muted">{truck.position?.source === "phone_fallback" ? "Updated from a marshal’s phone" : "Updated from truck GPS"}</p>}
              {truck.status === "signal-lost" && <p className="mt-3 text-sm text-warn">Last-known position may be out of date.</p>}
            </Card>
            <Card className="p-5">
              <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-gold"><Icon name="map-pin" className="size-4" />Meet-up</p>
              <h2 className="mt-3 text-base font-semibold">Meeting reference</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{truck.meetup.label}</p>
            </Card>
            <p className="px-1 text-xs leading-relaxed text-muted">On the road, follow your marshal. The map helps you find the crew; it doesn’t replace their directions.</p>
          </aside>
        </div>
      ) : !error && <div className="grid min-h-[340px] place-items-center rounded-card border border-line bg-panel text-sm text-muted" role="status">Loading truck…</div>}
    </div>
  )
}
function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180
  const h = Math.sin((b.lat - a.lat) * rad / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lng - a.lng) * rad / 2) ** 2
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)))
}
