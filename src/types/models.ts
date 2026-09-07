/**
 * Typed data models for Truck Tracker.
 * These shapes are the contract between mock data, the demo service layer and
 * the screens, so a real backend can replace demoApi without touching the UI.
 */

export type TruckStatus = "live" | "delayed" | "signal-lost"

export type AnnouncementCategory = "general" | "collection" | "on-the-road"

export type PhaseId = "jouvert" | "pretty-mas"

export interface Announcement {
  id: string
  category: AnnouncementCategory
  title: string
  body: string
  /** ISO 8601, UTC. */
  publishedAt: string
  pinned?: boolean
  /** True for seeded sample content; admin-created announcements omit it. */
  sample?: boolean
}

export interface TruckState {
  truckName: string
  status: TruckStatus
  /** Short human status line, e.g. "Rolling smooth." */
  message: string
  /** ISO 8601, UTC. */
  lastUpdateISO: string
}

export interface MeetingPoint {
  /** Name shown on the tracker, e.g. "J'ouvert meet-up". */
  name: string
  dateLabel: string
  timeLabel: string
  location: string
  note?: string
  /** False until organisers confirm real dates/locations. */
  confirmed: boolean
}

export interface ScheduleItem {
  id: string
  timeLabel: string
  title: string
  note?: string
}

export interface CostumeInfo {
  name: string
  collectionDateLabel: string
  collectionLocation: string
  bringWithYou: string[]
  confirmed: boolean
  note?: string
}

export interface GuidePhase {
  id: PhaseId
  name: string
  shortName: string
  description: string
  meeting: MeetingPoint
  schedule: ScheduleItem[]
  costume: CostumeInfo
}

export interface Faq {
  id: string
  question: string
  answer: string
}

export interface SamplePhoto {
  id: string
  /** Which collection filter the sample belongs to. */
  category: "jouvert" | "pretty-mas"
  title: string
  /** Index into the placeholder art gradient recipes. */
  variant: number
}

export interface GalleryPhoto extends SamplePhoto {
  kind: "sample"
}

export interface LocalPhoto {
  id: string
  kind: "local"
  category: "jouvert" | "pretty-mas"
  title: string
  /** Blob object URL, kept in memory only. */
  url: string
  fileName: string
  fileSize: number
  addedAt: string
}

export type Photo = GalleryPhoto | LocalPhoto

export type PhotoFilter = "all" | "jouvert" | "pretty-mas"

export interface NotificationPrefs {
  announcements: boolean
  truckStatus: boolean
}

/** Fields the demo admin can edit about the meeting point. */
export type MeetingOverrides = Partial<Pick<MeetingPoint, "dateLabel" | "timeLabel" | "location" | "name">> &
  Pick<MeetingPoint, "confirmed">

export interface DemoSnapshot {
  /** Band display name (editable in demo admin). */
  bandName: string
  /** Event label under the band name. */
  eventLabel: string
  truck: TruckState
  announcements: Announcement[]
  /** Ids of announcements the patron has opened. */
  readIds: string[]
  phases: GuidePhase[]
  faqs: Faq[]
  prefs: NotificationPrefs
}
