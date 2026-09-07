import {
  createMockData,
  createMockGuide,
  createMockTruck,
} from "@/data/mockData"
import type {
  Announcement,
  AnnouncementCategory,
  DemoSnapshot,
  MeetingOverrides,
  NotificationPrefs,
  PhaseId,
  TruckState,
  TruckStatus,
} from "@/types/models"
import { brand } from "@/config/brand"

/**
 * demoApi — the only place the screens read or write "server" data today.
 *
 * It fakes network latency and persists demo edits to localStorage under one
 * namespaced key, seeded from src/data/mockData.ts. Later, replace each
 * function's body with a fetch to the real API and keep the signatures — the
 * screens and store won't change.
 */

const STORAGE_KEY = "truck-tracker.demo.v1"

interface PersistedTruck extends Partial<Omit<TruckState, "lastUpdateISO">> {}

interface DemoPersistence {
  /** Admin-created announcements (seeded samples are recreated on each load). */
  announcements: Announcement[]
  /** Announcement ids the patron has opened. */
  readIds: string[]
  prefs: Partial<NotificationPrefs>
  truck: PersistedTruck
  meeting: Partial<Record<PhaseId, MeetingOverrides>>
  meta: { bandName?: string; eventLabel?: string }
}

function emptyPersistence(): DemoPersistence {
  return {
    announcements: [],
    readIds: [],
    prefs: {},
    truck: {},
    meeting: {},
    meta: {},
  }
}

function loadPersistence(): DemoPersistence {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyPersistence()
    const parsed = JSON.parse(raw) as Partial<DemoPersistence>
    return {
      announcements: parsed.announcements ?? [],
      readIds: parsed.readIds ?? [],
      prefs: parsed.prefs ?? {},
      truck: parsed.truck ?? {},
      meeting: parsed.meeting ?? {},
      meta: parsed.meta ?? {},
    }
  } catch {
    // Corrupt or unreadable demo state — start fresh rather than crash.
    localStorage.removeItem(STORAGE_KEY)
    return emptyPersistence()
  }
}

function persist(p: DemoPersistence): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
  } catch {
    // Storage full / unavailable. Demo edits just won't survive a refresh.
  }
}

function assemble(p: DemoPersistence): DemoSnapshot {
  const base = createMockData()
  const baseGuide = createMockGuide()

  const announcements = [...p.announcements, ...base.announcements]

  const phases = baseGuide.phases.map((phase) => {
    const overrides = p.meeting[phase.id]
    const meeting = overrides
      ? {
          ...phase.meeting,
          dateLabel: overrides.dateLabel ?? phase.meeting.dateLabel,
          timeLabel: overrides.timeLabel ?? phase.meeting.timeLabel,
          location: overrides.location ?? phase.meeting.location,
          confirmed: overrides.confirmed ?? phase.meeting.confirmed,
        }
      : phase.meeting
    return { ...phase, meeting }
  })

  return {
    bandName: p.meta.bandName ?? base.bandName,
    eventLabel: p.meta.eventLabel ?? base.eventLabel,
    truck: { ...createMockTruck(), ...p.truck },
    announcements,
    readIds: [...p.readIds].filter((id) =>
      announcements.some((a) => a.id === id),
    ),
    phases,
    faqs: baseGuide.faqs,
    prefs: { announcements: true, truckStatus: true, ...p.prefs },
  }
}

/** Fake network latency so loading states are real. */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function commit(
  ms: number,
  mutate: (p: DemoPersistence) => void,
): Promise<DemoSnapshot> {
  await sleep(ms)
  const p = loadPersistence()
  mutate(p)
  persist(p)
  return assemble(p)
}

export interface NewAnnouncement {
  category: AnnouncementCategory
  title: string
  body: string
  pinned: boolean
}

const TRUCK_MESSAGES: Record<TruckStatus, string> = {
  live: "Rolling smooth through Scarborough. See you at the meet point.",
  delayed:
    "Heavy traffic near the depot — the crew is working on a new ETA. Watch Updates.",
  "signal-lost":
    "We lost the truck's signal on the coast road. Latest word will land in Updates.",
}

export const demoApi = {
  /** Initial app bootstrap. */
  async loadDemo(): Promise<DemoSnapshot> {
    await sleep(380)
    return assemble(loadPersistence())
  },

  async addAnnouncement(input: NewAnnouncement): Promise<DemoSnapshot> {
    const announcement: Announcement = {
      id: `admin-${crypto.randomUUID()}`,
      category: input.category,
      title: input.title,
      body: input.body,
      pinned: input.pinned,
      publishedAt: new Date().toISOString(),
    }
    return commit(140, (p) => {
      p.announcements = [announcement, ...p.announcements]
    })
  },

  async markAnnouncementRead(id: string): Promise<DemoSnapshot> {
    return commit(80, (p) => {
      if (!p.readIds.includes(id)) p.readIds.push(id)
    })
  },

  async setTruckStatus(status: TruckStatus): Promise<DemoSnapshot> {
    return commit(140, (p) => {
      p.truck.status = status
      p.truck.message = TRUCK_MESSAGES[status]
    })
  },

  async setTruckName(name: string): Promise<DemoSnapshot> {
    return commit(140, (p) => {
      p.truck.truckName = name.trim() || createMockTruck().truckName
    })
  },

  async saveMeetingOverrides(
    phaseId: PhaseId,
    overrides: MeetingOverrides,
  ): Promise<DemoSnapshot> {
    return commit(140, (p) => {
      p.meeting[phaseId] = {
        ...p.meeting[phaseId],
        ...overrides,
      }
    })
  },

  async saveMeta(meta: {
    bandName: string
    eventLabel: string
  }): Promise<DemoSnapshot> {
    return commit(140, (p) => {
      p.meta = {
        bandName: meta.bandName.trim() || brand.bandName,
        eventLabel: meta.eventLabel.trim() || brand.eventLabel,
      }
    })
  },

  async savePrefs(prefs: NotificationPrefs): Promise<DemoSnapshot> {
    return commit(80, (p) => {
      p.prefs = prefs
    })
  },

  /** Wipe every demo edit and rebuild from the seed content. */
  async resetDemo(): Promise<DemoSnapshot> {
    await sleep(160)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Ignore — same handling as persist().
    }
    return assemble(loadPersistence())
  },
}
