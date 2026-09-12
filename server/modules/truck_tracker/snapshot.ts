export interface Position {
  lat: number; lng: number; heading: number | null; accuracy_m: number
  source: "phone_fallback" | "fmc920"; recorded_at: Date | string
}
export function pickPosition(positions: Position[], now = Date.now()): Position | null {
  const sorted = [...positions].sort((a, b) => +new Date(b.recorded_at) - +new Date(a.recorded_at))
  const fresh = sorted.filter(p => now - +new Date(p.recorded_at) <= 30000 && +new Date(p.recorded_at) <= now)
  return fresh.find(p => p.source === "fmc920") ?? fresh[0] ?? sorted[0] ?? null
}
export function validPosition(data: Record<string, unknown>): boolean {
  const { lat, lng, accuracy, heading } = data
  return typeof lat === "number" && Number.isFinite(lat) && Math.abs(lat) <= 90 &&
    typeof lng === "number" && Number.isFinite(lng) && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0) &&
    typeof accuracy === "number" && Number.isFinite(accuracy) && accuracy >= 0 && accuracy <= 200 &&
    (heading == null || (typeof heading === "number" && Number.isFinite(heading) && heading >= 0 && heading < 360))
}
