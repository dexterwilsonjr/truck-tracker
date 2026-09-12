export interface LiveTruck {
  name: string; publicLive: boolean; status: "not-live" | "live" | "delayed" | "signal-lost"; message: string
  meetup: { lat: number; lng: number; label: string }
  position: { lat: number; lng: number; accuracy: number; source: string; recordedAt: string } | null
  serverTime: string
}
