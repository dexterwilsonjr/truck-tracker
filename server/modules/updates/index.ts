/** Updates SKU — not deployed in Platform V1. */
export const MODULE = "updates" as const
export const DEPLOYED = false

export interface AnnouncementRecord {
  id: string
  bandId: string
  title: string
  body: string
  category: "general" | "collection" | "on-the-road"
  pinned: boolean
  publishedAt: string
}
