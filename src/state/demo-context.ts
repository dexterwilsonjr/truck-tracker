import { createContext, useContext } from "react"
import type {
  DemoSnapshot,
  MeetingOverrides,
  NotificationPrefs,
  PhaseId,
  TruckStatus,
} from "@/types/models"
import type { NewAnnouncement } from "@/services/demoApi"

export interface DemoActions {
  addAnnouncement(input: NewAnnouncement): Promise<void>
  markAnnouncementRead(id: string): Promise<void>
  setTruckStatus(status: TruckStatus): Promise<void>
  setTruckName(name: string): Promise<void>
  saveMeetingOverrides(
    phaseId: PhaseId,
    overrides: MeetingOverrides,
  ): Promise<void>
  saveMeta(meta: { bandName: string; eventLabel: string }): Promise<void>
  savePrefs(prefs: NotificationPrefs): Promise<void>
  resetDemo(): Promise<void>
}

export interface DemoContextValue {
  snapshot: DemoSnapshot
  actions: DemoActions
  /** True while a demo action is in flight (buttons show busy state). */
  busy: boolean
}

export const DemoContext = createContext<DemoContextValue | null>(null)

export function useDemo(): DemoContextValue {
  const value = useContext(DemoContext)
  if (!value) {
    throw new Error("useDemo must be used inside <DemoProvider>")
  }
  return value
}
