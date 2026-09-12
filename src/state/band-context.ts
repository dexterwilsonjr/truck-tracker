import { createContext, useContext } from "react"
import type { BandPublic } from "@/types/platform"
import type { ModuleCode } from "@/config/modules"
export interface BandContextValue {
  band: BandPublic
  isOrganizer: boolean
  moduleLive: (code: ModuleCode) => boolean
  comingOnline: (code: ModuleCode) => boolean
}

export const BandContext = createContext<BandContextValue | null>(null)

export function useBand(): BandContextValue {
  const ctx = useContext(BandContext)
  if (!ctx) throw new Error("useBand must be used inside BandProvider")
  return ctx
}

export function useOptionalBand(): BandContextValue | null {
  return useContext(BandContext)
}
