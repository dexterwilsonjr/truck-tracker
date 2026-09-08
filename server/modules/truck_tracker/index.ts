/**
 * Truck Tracker SKU — not deployed in Platform V1.
 *
 * Live build (after contract): FMC920 Codec 8/8E ingest, MapLibre last-known
 * pin, marshal iPhone fallback (`source: phone_fallback`), relative patron
 * distance, go-live before public precision, no camp 24/7 pin.
 *
 * V1: upsell only. Do not start TCP :5027 here.
 */
export const MODULE = "truck_tracker" as const
export const DEPLOYED = false

export type PositionSource = "fmc920" | "phone_fallback"

export interface TruckPosition {
  truckId: string
  lat: number
  lng: number
  heading?: number
  recordedAt: string
  source: PositionSource
}
