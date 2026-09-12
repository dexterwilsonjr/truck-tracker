import { useEffect, useState } from "react"
import { useBand } from "@/state/band-context"
import { api, ApiError } from "@/services/api"
import { BrandContactCard } from "@/features/guide/BrandContactCard"
import { BrandHero } from "@/components/brand/BrandVisuals"
import { Card } from "@/components/ui/Primitives"
import { Button } from "@/components/ui/Button"
interface Guide { title: string; location: string; schedule: string[]; notes: string[]; coverSrc?: string }
interface Update { id: string; title: string; body: string; imageSrc?: string }
interface Content { content: Guide | Update[]; updatedAt: string }
export function LiveContentScreen({ module }: { module: "guide" | "updates" }) {
  const { band } = useBand()
  const [data, setData] = useState<Content | null>(null)
  const [offline, setOffline] = useState(false)
  const [error, setError] = useState("")
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    const key = `tt-public-v1:${band.slug}:${module}`
    void api<Content>(`/public/bands/${band.slug}/content/${module}`, { signal: controller.signal }).then(result => {
      if (controller.signal.aborted) return
      setData(result); setOffline(false); setError("")
      try { localStorage.setItem(key, JSON.stringify(result)) } catch { /* Cache is optional. */ }
    }).catch(e => {
      if (controller.signal.aborted) return
      if (e instanceof ApiError && [403, 404].includes(e.status)) { try { localStorage.removeItem(key) } catch { /* Optional cache. */ } setData(null); setError(e.message); return }
      try {
        const cached = JSON.parse(localStorage.getItem(key) ?? "null") as Content | null
        if (cached?.content && cached.updatedAt) { setData(cached); setOffline(true); return }
      } catch { /* Corrupt or disabled cache. */ }
      setError("Could not load event information. Connect and try again.")
    })
    const online = () => setRetry(r => r + 1)
    window.addEventListener("online", online)
    return () => { controller.abort(); window.removeEventListener("online", online) }
  }, [band.slug, module, retry])
  const guide = data && !Array.isArray(data.content) ? data.content : null
  const updates = data && Array.isArray(data.content) ? data.content : []
  return (
    <div className="space-y-6">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">{band.name}</p>
        <h1 className="mt-2 font-display text-[30px] font-bold leading-tight sm:text-4xl">{module === "guide" ? "Event guide" : "Latest updates"}</h1>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">{module === "guide" ? "Your meet-up, your schedule, your day on the road." : "The latest word from your crew, all in one place."}</p>
      </header>
      {offline && <p role="status" className="rounded-2xl border border-warn/30 bg-panel p-4 text-sm text-warn">Offline copy · saved {data && new Date(data.updatedAt).toLocaleString()}</p>}
      {(error || offline) && <div className="space-y-3">{error && <p role="alert">{error}</p>}<Button onClick={() => setRetry(r => r + 1)}>Try again</Button></div>}
      {!data && !error && <p className="rounded-card border border-line bg-panel p-8 text-sm text-muted" role="status">Loading event information…</p>}
      {updates.length > 0 && <div className="grid items-start gap-5 md:grid-cols-2">
        {updates.map((update, index) => (
          <Card key={update.id} className="overflow-hidden p-0">
            {update.imageSrc && <img src={update.imageSrc} alt="" loading={index === 0 ? "eager" : "lazy"} decoding="async" className="aspect-[16/9] w-full object-cover" />}
            <div className="p-5 sm:p-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold">Crew announcement</p>
              <h2 className="mt-2 text-xl font-semibold leading-snug">{update.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted">{update.body}</p>
            </div>
          </Card>
        ))}
      </div>}
      {data && Array.isArray(data.content) && updates.length === 0 && <Card className="p-8 text-center"><h2 className="text-lg font-semibold">You’re up to date</h2><p className="mt-2 text-sm text-muted">Announcements from the crew will appear here.</p></Card>}
      {guide && <>
        <BrandHero src={guide.coverSrc} alt={guide.title} />
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <Card className="p-5 sm:p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold">The itinerary</p>
            <h2 className="mt-2 text-xl font-semibold">{guide.title}</h2>
            <p className="mt-3 rounded-xl bg-teal/8 px-4 py-3 text-sm leading-relaxed text-muted">{guide.location}</p>
            <ol className="mt-5 divide-y divide-line">{guide.schedule.map((item, index) => <li key={item} className="flex gap-3 py-4"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gold/10 text-xs font-semibold tabular-nums text-gold">{String(index + 1).padStart(2, "0")}</span><p className="pt-0.5 text-sm leading-relaxed">{item}</p></li>)}</ol>
          </Card>
          <div className="space-y-5">
            <Card className="p-5 sm:p-6"><h2 className="text-base font-semibold">Before you head out</h2><ul className="mt-4 space-y-4">{guide.notes.map(note => <li key={note} className="flex gap-3 text-sm leading-relaxed text-muted"><span className="mt-2 size-1 shrink-0 rounded-full bg-gold" />{note}</li>)}</ul></Card>
            <BrandContactCard />
          </div>
        </div>
      </>}
    </div>
  )
}
