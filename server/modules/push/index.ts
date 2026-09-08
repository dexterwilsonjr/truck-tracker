/** Push SKU — not deployed in Platform V1. */
export const MODULE = "push" as const
export const DEPLOYED = false

export interface PushSubscriptionRecord {
  endpoint: string
  keys: { p256dh: string; auth: string }
}
