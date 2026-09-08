import { useEffect, useState } from "react"
import { Navigate } from "react-router-dom"

import { isLiveApi } from "@/lib/live-api"
import { api } from "@/services/api"

export function HomeRedirect() {
  const [slug, setSlug] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLiveApi()) return
    void api<{ bands: { slug: string }[] }>("/public/bands")
      .then((data) => {
        const first = data.bands[0]?.slug
        setSlug(first ?? "")
      })
      .catch(() => setError("Could not load bands."))
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
