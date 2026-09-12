import { useEffect, useRef, useState } from "react"
import { useBand } from "@/state/band-context"
import { useAuth } from "@/state/auth-context"
import { api, ApiError } from "@/services/api"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Primitives"

export function OrganizerAdminScreen() {
  const { band } = useBand()
  const { logout } = useAuth()
  const [shareId, setShareId] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [sent, setSent] = useState("")
  const wake = useRef<WakeLockSentinel | null>(null)
  const base = `/admin/bands/${band.slug}/tracker`
  useEffect(() => {
    const controller = new AbortController()
    void api<{ shareId: string | null }>(base, { signal: controller.signal }).then(d => setShareId(d.shareId)).catch(e => { if (!controller.signal.aborted) setError(e.message) })
    return () => controller.abort()
  }, [base])
  async function run(action: () => Promise<void>) {
    setBusy(true); setError(""); setNotice("")
    try { await action() } catch (e) { setError(e instanceof Error ? e.message : "Could not save. Try again.") } finally { setBusy(false) }
  }
  async function post(action: string, data: object = {}) {
    return api<{ shareId?: string }>(`${base}/${action}`, { method: "POST", body: JSON.stringify(data) })
  }
  useEffect(() => {
    if (!sharing || !shareId) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    const controller = new AbortController()
    async function send() {
      if (stopped || document.hidden) return
      try {
        const position = await locate()
        if (stopped || document.hidden) return
        await api(`${base}/position`, { method: "POST", signal: controller.signal, body: JSON.stringify({ shareId, lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy, heading: position.coords.heading }) })
        if (!stopped) { setSent(new Date().toLocaleTimeString()); setError("") }
      } catch (e) {
        if (stopped) return
        setError(e instanceof Error ? e.message : "Location unavailable. Enable Precise Location and try outside.")
        if (e instanceof ApiError && [401, 403, 409].includes(e.status)) { setSharing(false); return }
      }
      if (!stopped) timer = setTimeout(() => void send(), 10000)
    }
    async function acquireWake() {
      try { if ("wakeLock" in navigator) wake.current = await navigator.wakeLock.request("screen") } catch { /* Sharing still works with screen kept on manually. */ }
      if (stopped) { void wake.current?.release(); wake.current = null }
    }
    function visibility() {
      if (document.hidden) { setSharing(false); setNotice("Sharing paused when the page was hidden. Tap Keep sharing when you return.") }
    }
    document.addEventListener("visibilitychange", visibility)
    void acquireWake(); void send()
    return () => { stopped = true; clearTimeout(timer); controller.abort(); document.removeEventListener("visibilitychange", visibility); void wake.current?.release(); wake.current = null }
  }, [sharing, shareId, base])
  return <div className="space-y-5"><header><p className="text-gold">Crew controls · {band.name}</p><h1 className="font-display text-3xl font-bold">Take the truck live</h1><p className="mt-2 text-muted">Use your crew phone outdoors with Precise Location enabled. Keep this page open and the screen on while sharing.</p></header>
    {error && <p role="alert" className="text-danger">{error}</p>}{notice && <p role="status">{notice}</p>}
    <Card className="space-y-4 p-5"><p className="font-semibold">{sharing ? "Sharing while this page stays open" : shareId ? "Live session open · phone sharing paused" : "Not sharing"}</p>
      <div className="flex flex-wrap gap-3"><Button busy={busy} disabled={sharing} onClick={() => void run(async () => { const result = await post("go-live"); setShareId(result.shareId ?? null); setNotice("Live session started. Send your location or tap Keep sharing.") })}>Go live</Button>
      <Button busy={busy} disabled={!shareId || sharing} variant="secondary" onClick={() => void run(async () => { const p = await locate(); await post("position", { shareId, lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, heading: p.coords.heading }); setSent(new Date().toLocaleTimeString()) })}>Send location once</Button>
      <Button disabled={!shareId || busy} onClick={() => setSharing(s => !s)}>{sharing ? "Pause sharing" : "Keep sharing"}</Button>
      <Button variant="danger" busy={busy} disabled={!shareId} onClick={() => { setSharing(false); void run(async () => { await post("end-live"); setShareId(null); setSent(""); setNotice("Live ended. The public truck pin is hidden.") }) }}>End live</Button></div>
      {sent && <p aria-live="polite" className="text-sm text-muted">Last sent at {sent}</p>}
      <p className="text-xs text-muted">Pause stops phone updates. End live hides the public pin. Turning off the screen may pause location access on iPhone.</p>
    </Card>
    <Card className="space-y-3 p-5"><label className="block" htmlFor="delay-message">Delay update</label><input id="delay-message" maxLength={240} value={message} onChange={e => setMessage(e.target.value)} className="w-full rounded-xl border border-line bg-night p-3" placeholder="Tell the band what’s happening" /><Button busy={busy} disabled={!shareId || !message.trim()} onClick={() => void run(async () => { await post("delayed", { message }); setNotice("Delay update published.") })}>Mark delayed</Button></Card>
    <div className="flex gap-3"><Button to={`/${band.slug}`} variant="secondary">Open patron view</Button><Button variant="danger" busy={busy} onClick={() => { setSharing(false); void run(async () => { if (shareId) await post("end-live"); await logout() }) }}>End live and log out</Button></div>
  </div>
}
function locate(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("Location is unavailable in this browser.")); return }
    navigator.geolocation.getCurrentPosition(resolve, () => reject(new Error("Location unavailable. Allow Precise Location, keep this page open and try outside.")), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
  })
}
