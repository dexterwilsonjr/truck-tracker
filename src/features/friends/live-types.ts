/**
 * Mirrors the JSON returned by `server/modules/friends/index.ts`.
 * Kept in step by hand, the same way `tracker/live-types.ts` mirrors the truck
 * payload, because the server has no type exporter to import from.
 */

/** `null` in the API means the fix is too old to show at all. */
export type FriendFreshness = "live" | "stationary" | "stale"

type PositionSource = "browser" | "native"

export interface FriendPosition {
  lat: number
  lng: number
  accuracy: number
  heading: number | null
  motionState: "moving" | "stationary" | "unknown"
  /** Which writer produced the fix: this app's browser or a native install. */
  source: PositionSource
  capturedAt: string
}

export interface FriendEntry {
  connectionId: string
  userId: string
  name: string
  status: "accepted" | "blocked"
  blockedByMe: boolean
  sharing: boolean
  freshness: FriendFreshness | null
  ageSeconds: number | null
  position: FriendPosition | null
}

export interface EnrolledDevice {
  id: string
  platform: "ios" | "android"
  appVersion: string | null
  expiresAt: string
  lastSeenAt: string | null
}

export interface FriendsView {
  sharing: {
    active: boolean
    sessionId: string | null
    endsAt: string | null
    maxHours: number
  }
  invites: { id: string; expiresAt: string }[]
  devices: EnrolledDevice[]
  maxDevices: number
  friends: FriendEntry[]
  serverTime: string
}

export interface FriendPin {
  userId: string
  name: string
  freshness: FriendFreshness
  ageSeconds: number
  position: FriendPosition
}
