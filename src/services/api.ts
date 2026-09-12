import { liveApiUrl } from "@/lib/live-api"
import type { ApiErrorBody } from "@/types/platform"

export class ApiError extends Error {
  readonly status: number
  readonly body: ApiErrorBody | null

  constructor(status: number, body: ApiErrorBody | null, message: string) {
    super(message)
    this.status = status
    this.body = body
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const base = liveApiUrl()
  if (!base) {
    throw new ApiError(0, null, "Live API is not connected.")
  }
  const headers = new Headers(init?.headers)
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }
  const res = await fetch(`${base}${path}`, {
    ...init,
    credentials: "include",
    signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(12000)]) : AbortSignal.timeout(12000),
    headers,
  })
  const json = (await res.json().catch(() => null)) as ApiErrorBody | T | null
  if (!res.ok) {
    const body = json as ApiErrorBody | null
    throw new ApiError(
      res.status,
      body,
      body?.error?.message ?? "Something went wrong. Try again.",
    )
  }
  if (json === null) throw new ApiError(res.status, null, "The service returned an invalid response. Please try again.")
  return json as T
}
