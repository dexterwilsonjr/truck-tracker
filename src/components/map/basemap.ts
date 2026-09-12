import * as maplibregl from "maplibre-gl"

/**
 * Shared maplibre setup for any map in the app.
 *
 * Extracted so the truck map and the friends map cannot drift apart in the
 * details that are easy to get wrong twice: the dark basemap URL, the raster
 * fallback when that tile host is unreachable, and the ready/failed signalling
 * that keeps a broken map from looking like an empty one.
 */

const DARK_STYLE = "https://tiles.openfreemap.org/styles/dark"
/** If the vector style has not loaded by now, fall back to plain raster tiles. */
const FALLBACK_AFTER_MS = 12_000
/**
 * Once on raster tiles, how long to wait before calling the map unusable.
 *
 * A tile host that is unreachable can hang without ever raising an error, which
 * would otherwise leave a blank canvas and a permanent "opening" message. Saying
 * so is better than pretending the map is still arriving.
 */
const RASTER_GRACE_MS = 6_000

const RASTER_FALLBACK: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
}

export interface BasemapOptions {
  container: HTMLElement
  center: [number, number]
  zoom: number
  onReady: () => void
  /** Called only when the map is unusable, not when it fell back to raster. */
  onFail: () => void
}

export interface Basemap {
  map: maplibregl.Map
  destroy: () => void
}

/**
 * Create a basemap, or return null when the environment cannot support one.
 *
 * Callers own the returned map's markers; `destroy` removes the instance and
 * every listener this function attached.
 */
export function createBasemap(options: BasemapOptions): Basemap | null {
  const { container, center, zoom, onReady, onFail } = options
  let map: maplibregl.Map
  try {
    map = new maplibregl.Map({
      container,
      center,
      zoom,
      style: DARK_STYLE,
      attributionControl: { compact: true },
    })
  } catch {
    return null
  }

  let fellBack = false
  let isReady = false
  let rasterTimer: ReturnType<typeof setTimeout> | undefined
  const useRaster = () => {
    if (fellBack) return
    fellBack = true
    try {
      map.setStyle(RASTER_FALLBACK)
    } catch {
      onFail()
      return
    }
    rasterTimer = setTimeout(() => {
      if (!isReady) onFail()
    }, RASTER_GRACE_MS)
  }

  const timer = setTimeout(useRaster, FALLBACK_AFTER_MS)
  const ready = () => {
    isReady = true
    clearTimeout(timer)
    clearTimeout(rasterTimer)
    onReady()
  }
  map.on("load", ready)
  map.on("idle", ready)
  map.on("error", () => {
    if (!fellBack) useRaster()
    else if (!isReady) onFail()
  })
  map.addControl(new maplibregl.NavigationControl(), "top-right")

  return {
    map,
    destroy: () => {
      clearTimeout(timer)
      clearTimeout(rasterTimer)
      map.remove()
    },
  }
}

export { maplibregl }
