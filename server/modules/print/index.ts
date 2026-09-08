/** Print SKU — not deployed in Platform V1. */
export const MODULE = "print" as const
export const DEPLOYED = false

export type PrintStatus = "requested" | "accepted" | "ready"

export interface PrintRequest {
  libraryObjectKey: string
  status: PrintStatus
}
