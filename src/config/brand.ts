/**
 * Brand configuration — the single place to rebrand this app for a real band.
 *
 * To ship Truck Tracker for Fog Angels, Iconic Mas or another band:
 *   1. Change bandName, eventYear and eventLabel.
 *   2. Swap logo artwork for the band's own (logoPlaceholder below stays until then).
 *   3. Adjust palette hex values (they are applied as CSS variables at runtime,
 *      overriding the defaults in src/index.css).
 *   4. Fill in contact details so buttons become live; empty strings keep the
 *      screens in their friendly "not set up yet" state.
 */

export interface BrandPalette {
  night: string
  panel: string
  raised: string
  line: string
  ink: string
  muted: string
  faint: string
  gold: string
  goldink: string
  teal: string
  live: string
  warn: string
  sky: string
  danger: string
}

export interface BrandContact {
  phone: string
  whatsapp: string
  email: string
  instagram: string
  website: string
}

export interface Brand {
  /** Product / app name shown in the top bar. */
  productName: string
  /** The band this build represents. Placeholder until a band is chosen. */
  bandName: string
  eventYear: number
  /** Small line shown under the band name on the tracker. */
  eventLabel: string
  tagline: string
  /** Swap for the band's own logo. Until then a gold monogram is shown. */
  logoPlaceholder: {
    monogram: string
    caption: string
  }
  /** Apply this palette at runtime via installBrand(). */
  palette: BrandPalette
  /** Empty strings = channel not configured -> screens show an unavailable state. */
  contact: BrandContact
  /** Optional registration / ticket link on the Guide. Empty = hidden state. */
  registrationUrl: string
}

export const brand: Brand = {
  productName: "Truck Tracker",
  bandName: "Tobago Carnival",
  eventYear: 2026,
  eventLabel: "J'ouvert & Pretty Mas",
  tagline: "Find the truck. Catch the vibe.",
  logoPlaceholder: {
    monogram: "TT",
    caption: "Placeholder mark — swap for the band's logo",
  },
  palette: {
    night: "#070b15",
    panel: "#0d1424",
    raised: "#151e33",
    line: "#23304d",
    ink: "#f3f5fb",
    muted: "#98a3ba",
    faint: "#626f8c",
    gold: "#eab84c",
    goldink: "#221703",
    teal: "#31d6bd",
    live: "#3ddc97",
    warn: "#f5a524",
    sky: "#74b3ff",
    danger: "#f87171",
  },
  contact: {
    phone: "",
    whatsapp: "",
    email: "",
    instagram: "",
    website: "",
  },
  registrationUrl: "",
}

/** Push brand-derived CSS variables into :root so every token follows brand.ts. */
export function installBrand(): void {
  const root = document.documentElement
  for (const [token, value] of Object.entries(brand.palette)) {
    root.style.setProperty(`--color-${token}`, value)
  }
  document.title = brand.productName
}
