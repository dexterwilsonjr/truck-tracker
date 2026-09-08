/** Guide SKU — not deployed in Platform V1. */
export const MODULE = "guide" as const
export const DEPLOYED = false

export interface GuidePayload {
  bandId: string
  phases: unknown
  faqs: unknown
}
