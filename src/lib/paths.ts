const RESERVED = new Set([
  "demo",
  "privacy",
  "platform",
  "admin",
  "login",
  "register",
  "forgot",
  "reset",
  "change-password",
])

export function isReservedBandSlug(slug: string): boolean {
  return RESERVED.has(slug)
}

/** Prefix patron routes with /:bandSlug when the live API is on. */
export function bandHref(slug: string | undefined, path: string): string {
  const normalised = path.startsWith("/") ? path : `/${path}`
  if (!slug) return normalised === "" ? "/" : normalised
  if (normalised === "/") return `/${slug}`
  return `/${slug}${normalised}`
}
