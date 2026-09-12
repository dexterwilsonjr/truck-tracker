import { useState } from "react"

import { brand } from "@/config/brand"
import type { BrandPhoto } from "@/config/brands/types"
import { Modal } from "@/components/ui/Modal"
import { Chip } from "@/components/ui/Primitives"

export function BrandAtmosphere() {
  const src = brand.visuals?.atmosphereSrc
  if (!src) return null
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <img src={src} alt="" className="h-full w-full object-cover opacity-20" />
      <div className="absolute inset-0 bg-gradient-to-b from-night/65 via-night/90 to-night" />
    </div>
  )
}

export function BrandHero({
  src,
  alt,
  kicker,
}: {
  src?: string
  alt: string
  kicker?: string
}) {
  const image = src ?? brand.visuals?.heroSrc
  if (!image) return null
  return (
    <figure className="relative overflow-hidden rounded-card border border-line bg-panel shadow-card">
      <img src={image} alt={alt} decoding="async" className="aspect-[16/9] w-full object-cover object-[center_35%] sm:aspect-[21/9]" />
      <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-night/70 to-transparent px-4 pb-3 pt-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold">
          {kicker ?? brand.kicker ?? brand.bandName}
        </p>
      </figcaption>
    </figure>
  )
}

export function BandPhotoGrid({
  photos = brand.visuals?.gallery ?? [],
  caption = "Band artwork · not a live upload",
}: {
  photos?: BrandPhoto[]
  caption?: string
}) {
  const [filter, setFilter] = useState<"all" | "jouvert" | "pretty-mas">("all")
  const [open, setOpen] = useState<BrandPhoto | null>(null)
  if (photos.length === 0) return null

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex gap-1 rounded-full border border-line bg-panel p-1" role="group" aria-label="Filter band photos">
          {([ ["all", "All photos"], ["pretty-mas", "Pretty Mas"], ["jouvert", "J’ouvert"] ] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`min-h-11 rounded-full px-4 text-sm font-semibold transition ${filter === value ? "bg-gold text-goldink" : "text-muted hover:bg-white/5"}`}>{label}</button>)}
        </div>
        <p className="text-xs text-muted" aria-live="polite">{photos.filter(p => filter === "all" || p.category === filter).length} images</p>
      </div>
      <ul aria-label="Band photos" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {photos.filter(p => filter === "all" || p.category === filter).map((photo) => (
          <li key={photo.src}>
            <button
              type="button"
              onClick={() => setOpen(photo)}
              className="group relative flex aspect-square w-full overflow-hidden rounded-2xl border border-line bg-raised text-left transition focus-visible:outline-2"
              aria-label={`View ${photo.title}`}
            >
              <img
                src={photo.src}
                alt={photo.alt}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition duration-300 motion-safe:group-hover:scale-[1.03]"
              />
              <span className="absolute inset-x-0 bottom-0 flex items-end bg-gradient-to-t from-night/90 to-transparent px-3 pb-2 pt-10">
                <span className="line-clamp-2 text-[13px] font-semibold leading-snug text-ink">{photo.title}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <Modal open={open !== null} onClose={() => setOpen(null)} title={open?.title ?? "Photo"} wide>
        {open && (
          <div className="space-y-3">
            <img src={open.src} alt={open.alt} className="max-h-[62vh] w-full rounded-2xl object-contain" />
            <Chip tone="gold" dot={false}>
              {caption}
            </Chip>
          </div>
        )}
      </Modal>
    </section>
  )
}
