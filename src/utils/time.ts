/**
 * Small time helpers used to keep seeded "sample" timestamps feeling fresh
 * whenever the demo data is rebuilt (the demo is rebuilt after a reset).
 */

export function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString()
}

export function hoursAgo(hours: number): string {
  return minutesAgo(hours * 60)
}

export function daysAgo(days: number): string {
  return hoursAgo(days * 24)
}

export function timeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })
}

/** "just now", "4m ago", "2h ago", "3d ago", then a plain date. */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const diffMs = Date.now() - then
  if (Number.isNaN(then) || diffMs < 0) return timeOfDay(iso)
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString([], {
    day: "numeric",
    month: "short",
  })
}
