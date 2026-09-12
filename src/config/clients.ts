/**
 * Client registry: one entry per paying band.
 *
 * Adding a band is a brand pack, an entry here, an asset folder, and two commands:
 *
 *   npm run brand -- <id>                 # upsert band row, truck, content, entitlements
 *   VITE_BRAND=<id> npm run build:live    # build that client's web bundle
 *
 * `appId` becomes the licensed bundle identifier. One licence key covers one
 * appId on both platforms, so it must be final before keys are generated.
 */
import type { Brand } from "./brands/types.ts"
import { fogAngelsBrand } from "./brands/fog-angels.ts"
import { originalBrand } from "./brands/original.ts"

export interface ClientApp {
  /** Stable id used by the CLI, `VITE_BRAND`, and the brand pack id. */
  id: string
  /** Name shown under the icon on the device. */
  appName: string
  /** Android applicationId and iOS bundleIdentifier. One licence key per value. */
  appId: string
  /** Palette, type, logo, copy, and the band this client publishes. */
  brand: Brand
}

export const CLIENTS: Record<string, ClientApp> = {
  original: {
    id: "original",
    appName: "Truck Tracker",
    appId: "com.windiesgroup.trucktracker",
    brand: originalBrand,
  },
  "fog-angels": {
    id: "fog-angels",
    appName: "Fog Angels",
    appId: "com.windiesgroup.fogangels",
    brand: fogAngelsBrand,
  },
}

/** Local checks, Playwright, and the sales demo stay on the original pack. */
export const DEFAULT_CLIENT_ID = "original"

export function clientById(id: string): ClientApp | null {
  return CLIENTS[id] ?? null
}
