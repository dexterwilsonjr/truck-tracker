import { useEffect, useState } from "react"
import { Navigate } from "react-router-dom"

import { brand } from "@/config/brand"
import { isLiveApi } from "@/lib/live-api"
import { api } from "@/services/api"

export function HomeRedirect() {
  const [slug, setSlug] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLiveApi()) return
    void api<{ bands: { slug: string }[] }>("/public/bands")
      .then((data) => {
        const first = data.bands.find(b => b.slug === brand.bandSlug)?.slug ?? data.bands[0]?.slug
        if (first) { try { localStorage.setItem("tt-home-band", first) } catch { /* Optional cache. */ } }
        setSlug(first ?? "")
      })
      .catch(() => {
        try { const cached = localStorage.getItem("tt-home-band"); if (cached) { setSlug(cached); return } } catch { /* Optional cache. */ }
        setError("Could not load bands. Check your connection and reload.")
      })
  }, [])

  if (!isLiveApi()) return <Navigate to="/" replace />
  if (error) {
    return (
      <div className="px-4 py-16 text-center text-sm text-muted">{error}</div>
    )
  }
  if (slug === null) {
    return (
      <div className="grid min-h-dvh place-items-center text-sm text-muted">
        Loading…
      </div>
    )
  }
  if (!slug) {
    return (
      <div className="px-4 py-16 text-center text-sm text-muted">
        No public bands yet. Seed the database.
      </div>
    )
  }
  return <Navigate to={`/${slug}`} replace />
}
