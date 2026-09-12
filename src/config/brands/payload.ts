import type { Brand } from "./types.ts"

/**
 * The slice of a brand pack stored in `bands.brand` (jsonb).
 *
 * The shared web PWA serves every band by slug, so it reads this to skin each
 * band without a rebuild. It therefore carries the whole visual identity:
 * palette, type, logo, contact, and copy. Image binaries stay in
 * `public/brands/<id>/` and are referenced by path.
 *
 * Additive only: rows written before a field existed simply omit it, and
 * readers must treat every field as optional.
 *
 * The map-shaped interfaces (palette, contact, logoPlaceholder) are widened to
 * `Record<string, string>` because that is genuinely what they are, and because
 * postgres.js requires JSON-compatible objects: named interfaces do not get an
 * implicit index signature.
 */
export function brandPayload(pack: Brand) {
  return {
    productName: pack.productName,
    bandName: pack.bandName,
    tagline: pack.tagline,
    heroTitle: pack.heroTitle,
    kicker: pack.kicker ?? null,
    footerLine: pack.footerLine ?? null,
    logoSrc: pack.logoSrc ?? null,
    logoWide: pack.logoWide ?? false,
    fontDisplay: pack.fontDisplay ?? null,
    fontsHref: pack.fontsHref ?? null,
    logoPlaceholder: { ...pack.logoPlaceholder } as Record<string, string>,
    palette: { ...pack.palette } as Record<string, string>,
    contact: { ...pack.contact } as Record<string, string>,
    registrationUrl: pack.registrationUrl,
    visuals: pack.visuals
      ? {
          heroSrc: pack.visuals.heroSrc ?? null,
          atmosphereSrc: pack.visuals.atmosphereSrc ?? null,
          gallery: pack.visuals.gallery.map((photo) => ({
            src: photo.src,
            alt: photo.alt,
            title: photo.title,
            category: photo.category,
          })),
        }
      : null,
  }
}
