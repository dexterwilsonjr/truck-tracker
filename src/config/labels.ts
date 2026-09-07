import type {
  AnnouncementCategory,
  PhaseId,
  TruckStatus,
} from "@/types/models"

/**
 * Human display metadata for the model unions. UI reads these instead of
 * scattering label strings across screens.
 */

export interface ToneMeta {
  label: string
  /** Tailwind color token name used for the accent dot / chip. */
  tone: "teal" | "gold" | "sky" | "live" | "warn" | "danger"
}

export const ANNOUNCEMENT_CATEGORIES: Record<AnnouncementCategory, ToneMeta> = {
  general: { label: "General", tone: "teal" },
  collection: { label: "Collection", tone: "gold" },
  "on-the-road": { label: "On the road", tone: "sky" },
}

export const CATEGORY_ORDER: AnnouncementCategory[] = [
  "general",
  "collection",
  "on-the-road",
]

export const TRUCK_STATUS_META: Record<
  TruckStatus,
  { label: string; tone: ToneMeta["tone"]; blurb: string }
> = {
  live: {
    label: "Live",
    tone: "live",
    blurb: "Rolling smooth and on schedule.",
  },
  delayed: {
    label: "Delayed",
    tone: "warn",
    blurb: "Running behind — watch Updates for the new ETA.",
  },
  "signal-lost": {
    label: "Signal lost",
    tone: "danger",
    blurb: "Last position may be stale. We'll update here soon.",
  },
}

export const PHASE_META: Record<PhaseId, { label: string; shortLabel: string }> = {
  jouvert: { label: "J'ouvert", shortLabel: "J'ouvert" },
  "pretty-mas": { label: "Pretty Mas", shortLabel: "Pretty Mas" },
}
