import { useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { Navigate, useLocation, useParams } from "react-router-dom"

import { brand } from "@/config/brand"
import { api, ApiError } from "@/services/api"
import type { BandPublic } from "@/types/platform"
import { BandContext } from "./band-context"
import type { BandContextValue } from "./band-context"
import { useAuth } from "@/state/auth-context"

export function BandProvider({ children }: { children: ReactNode }) {
  const { bandSlug } = useParams()
  const location = useLocation()
  const { user } = useAuth()
  const [band, setBand] = useState<BandPublic | null>(null)
  const [retry, setRetry] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!bandSlug) return
    let cancelled = false
    const controller = new AbortController()
    void api<{ band: BandPublic }>(`/public/bands/${bandSlug}`, { signal: controller.signal })
      .then((data) => {
        if (!cancelled) {
          setBand(data.band)
          try { localStorage.setItem(`tt-band:${bandSlug}`, JSON.stringify(data.band)) } catch { /* Optional public cache. */ }
          setError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          if (!(err instanceof ApiError && [403, 404].includes(err.status))) {
            try {
              const cached = JSON.parse(localStorage.getItem(`tt-band:${bandSlug}`) ?? "null") as BandPublic | null
              if (cached?.slug === bandSlug) { setBand(cached); setError(null); return }
            } catch { /* Optional public cache. */ }
          }
          setBand(null)
          setError(err instanceof ApiError && err.status === 404 ? `That band is not on ${brand.productName}.` : "Could not connect. Check your connection and try again.")
        }
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [bandSlug, retry])

  const value = useMemo<BandContextValue | null>(() => {
    if (!band) return null
    const isOrganizer =
      user?.platformRole === "platform_admin" ||
      user?.bandRoles.some(
        (m) => m.bandId === band.id && (m.role === "organizer" || m.role === "marshal"),
      ) === true
    return {
      band,
      isOrganizer,
      moduleLive: (code) => band.liveModules.includes(code),
      comingOnline: (code) => band.comingOnline.includes(code),
    }
  }, [band, user])

  if (error) {
    if (error.startsWith("That band is not on") && bandSlug && bandSlug !== brand.bandSlug) {
      const rest = location.pathname.replace(new RegExp(`^/${bandSlug}`), "") || ""
      return <Navigate to={`/${brand.bandSlug}${rest}${location.search}`} replace />
    }
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold">Band unavailable</h1>
        <p className="mt-2 text-sm text-muted">{error}</p><button className="mt-4 rounded-full bg-gold px-5 py-3 text-goldink" onClick={() => setRetry(r => r + 1)}>Try again</button>
      </div>
    )
  }

  if (!value) {
    return (
      <div className="grid min-h-dvh place-items-center text-sm text-muted">
        Loading band…
      </div>
    )
  }

  return <BandContext.Provider value={value}>{children}</BandContext.Provider>
}
