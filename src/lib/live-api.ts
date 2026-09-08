/** Production API. Unset = sales demo (local mock data). */
export function liveApiUrl(): string | undefined {
  const raw = import.meta.env.VITE_API_URL?.trim()
  return raw ? raw.replace(/\/$/, "") : undefined
}

export function isLiveApi(): boolean {
  return Boolean(liveApiUrl())
}
