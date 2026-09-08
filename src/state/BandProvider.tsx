import { createContext, useContext, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { useParams } from "react-router-dom"

import { api } from "@/services/api"
import type { BandPublic } from "@/types/platform"
import type { ModuleCode } from "@/config/modules"
import { useAuth } from "@/state/AuthProvider"

interface BandContextValue {
  band: BandPublic
  isOrganizer: boolean
  moduleLive: (code: ModuleCode) => boolean
  comingOnline: (code: ModuleCode) => boolean
}

const BandContext = createContext<BandContextValue | null>(null)

export function BandProvider({ children }: { children: ReactNode }) {
  const { bandSlug } = useParams()
  const { user } = useAuth()
  const [band, setBand] = useState<BandPublic | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!bandSlug) return
    let cancelled = false
    void api<{ band: BandPublic }>(`/public/bands/${bandSlug}`)
      .then((data) => {
        if (!cancelled) {
          setBand(data.band)
          setError(null)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBand(null)
          setError("That band is not on Truck Tracker.")
        }
      })
    return () => {
      cancelled = true
    }
  }, [bandSlug])

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
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold">Band not found</h1>
        <p className="mt-2 text-sm text-muted">{error}</p>
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

export function useBand(): BandContextValue {
  const ctx = useContext(BandContext)
  if (!ctx) throw new Error("useBand must be used inside BandProvider")
  return ctx
}

export function useOptionalBand(): BandContextValue | null {
  return useContext(BandContext)
}
