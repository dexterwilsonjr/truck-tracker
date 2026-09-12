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

export interface BandPresentation {
  slug: string
  name: string
  eventYear: number
  eventLabel: string
  tagline: string
  truckName: string
  meetup: { lat: number; lng: number; label: string }
  updates: { id: string; title: string; body: string; imageSrc?: string }[]
  guide: { title: string; location: string; schedule: string[]; notes: string[]; coverSrc?: string }
}

export interface BrandPhoto {
  src: string
  alt: string
  title: string
  category: "jouvert" | "pretty-mas"
}

export interface BrandVisuals {
  heroSrc?: string
  atmosphereSrc?: string
  gallery: BrandPhoto[]
}

export interface Brand {
  /** Brand pack id. Registered in `src/config/clients.ts`. */
  id: string
  productName: string
  bandName: string
  bandSlug: string
  eventYear: number
  eventLabel: string
  tagline: string
  heroTitle: string
  kicker?: string
  logoSrc?: string
  logoWide?: boolean
  fontDisplay?: string
  fontsHref?: string
  footerLine?: string
  logoPlaceholder: {
    monogram: string
    caption: string
  }
  palette: BrandPalette
  contact: BrandContact
  registrationUrl: string
  visuals?: BrandVisuals
  presentation: BandPresentation
}
