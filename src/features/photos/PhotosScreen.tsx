import { useEffect, useMemo, useRef, useState } from "react"

import type { LocalPhoto, Photo, PhotoFilter } from "@/types/models"
import { createSamplePhotos } from "@/data/mockData"
import { PHASE_META } from "@/config/labels"
import { Button } from "@/components/ui/Button"
import { Segmented } from "@/components/ui/Segmented"
import { Modal } from "@/components/ui/Modal"
import { EmptyState } from "@/components/ui/EmptyState"
import { Chip } from "@/components/ui/Primitives"
import { Icon } from "@/components/ui/Icon"
import { photoArt, formatFileSize } from "@/features/photos/PhotoArt"
import { AddPhotosSheet } from "@/features/photos/AddPhotosSheet"
import { CrossSell } from "@/features/upsell/CrossSell"
import { useDemoHref } from "@/lib/demo-base"

const FILTERS: { value: PhotoFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "jouvert", label: "J'ouvert" },
  { value: "pretty-mas", label: "Pretty Mas" },
]

const MAX_PHOTOS = 20
const MAX_SIZE_MB = 10

export function PhotosScreen() {
  const [filter, setFilter] = useState<PhotoFilter>("all")
  const [localPhotos, setLocalPhotos] = useState<LocalPhoto[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null)
  const libraryTo = useDemoHref("/library")

  // Revoke object URLs when this screen unmounts.
  const photosRef = useRef<LocalPhoto[]>(localPhotos)
  useEffect(() => {
    photosRef.current = localPhotos
  }, [localPhotos])
  useEffect(() => {
    return () => {
      for (const photo of photosRef.current) {
        URL.revokeObjectURL(photo.url)
      }
    }
  }, [])

  const samples: Photo[] = useMemo(
    () => createSamplePhotos().map((p) => ({ ...p, kind: "sample" as const })),
    [],
  )

  const visible = [...localPhotos, ...samples].filter(
    (photo) => filter === "all" || photo.category === filter,
  )

  function removeLocal(photo: LocalPhoto) {
    URL.revokeObjectURL(photo.url)
    setLocalPhotos((prev) => prev.filter((p) => p.id !== photo.id))
  }

  const addLabel =
    filter === "all"
      ? "jouvert"
      : filter

  return (
    <div className="space-y-6 motion-safe:animate-fade-up">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[30px] leading-none font-bold tracking-tight sm:text-4xl">
            Photos
          </h1>
          <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-muted">
            Share the road with the band — pick up to {MAX_PHOTOS} photos (up
            to {MAX_SIZE_MB} MB each).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            icon={<Icon name="plus" className="size-5" />}
            onClick={() => setPickerOpen(true)}
          >
            Add photos
          </Button>
          <Button variant="secondary" to={libraryTo}>
            Truck Tracker Library
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Filter photos"
          options={FILTERS}
          value={filter}
          onChange={setFilter}
          className="max-w-xl"
        />
        {localPhotos.length > 0 && (
          <p className="text-xs text-faint" aria-live="polite">
            {localPhotos.length} local preview{localPhotos.length === 1 ? "" : "s"} added
          </p>
        )}
      </div>

      <p className="rounded-2xl border border-warn/30 bg-warn/[0.07] px-4 py-3 text-[13px] leading-relaxed text-warn">
        Local preview only. Photos are not uploaded and will clear when you
        refresh.
      </p>

      {visible.length === 0 ? (
        <EmptyState
          icon="image"
          title={`No ${filter === "all" ? "" : PHASE_META[filter].label + " "}photos yet`}
          body="Start the gallery off — add a photo from this device for a local preview."
          action={
            <Button onClick={() => setPickerOpen(true)}>
              Add your first photo
            </Button>
          }
        />
      ) : (
        <ul
          aria-label="Photo gallery"
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
        >
          {visible.map((photo) => (
            <li key={photo.id} className="relative">
              <button
                type="button"
                onClick={() => setLightboxPhoto(photo)}
                className="group relative block aspect-square w-full overflow-hidden rounded-2xl border border-line bg-raised text-left transition focus-visible:outline-2"
                aria-label={`View ${photo.title}`}
              >
                {photo.kind === "sample" ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 block"
                    style={photoArt(photo.variant)}
                  />
                ) : (
                  <img
                    src={photo.url}
                    alt={photo.title}
                    className="absolute inset-0 h-full w-full object-cover"
                    loading="lazy"
                  />
                )}
                <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-night/90 to-transparent px-3 pb-2 pt-10">
                  <span className="truncate text-[12px] font-semibold text-ink">
                    {photo.title}
                  </span>
                </span>
                {photo.kind === "local" && (
                  <span className="absolute left-2 top-2">
                    <Chip tone="gold">Local</Chip>
                  </span>
                )}
              </button>
              {photo.kind === "local" && (
                <button
                  type="button"
                  aria-label={`Remove ${photo.title} from selection`}
                  onClick={() => removeLocal(photo)}
                  className="absolute right-2 top-2 grid size-11 place-items-center rounded-full border border-line bg-night/80 text-muted backdrop-blur-sm transition hover:text-danger"
                >
                  <Icon name="x" className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <AddPhotosSheet
        key={`${pickerOpen}:${addLabel}`}
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        defaultCategory={addLabel}
        onAdd={(entries) => {
          setLocalPhotos((prev) => [...prev, ...entries])
          setPickerOpen(false)
        }}
      />

      <PhotoLightbox
        photo={lightboxPhoto}
        onClose={() => setLightboxPhoto(null)}
      />

      <CrossSell exclude="photos" />
    </div>
  )
}

function PhotoLightbox({
  photo,
  onClose,
}: {
  photo: Photo | null
  onClose: () => void
}) {
  const caption = photo
    ? photo.kind === "sample"
      ? `${PHASE_META[photo.category].label} · sample artwork`
      : `${PHASE_META[photo.category].label} · local preview`
    : ""

  return (
    <Modal open={photo !== null} onClose={onClose} title="Photo preview" wide>
      {photo && (
        <div className="space-y-4">
          <div className="flex items-center justify-center overflow-hidden rounded-2xl border border-line bg-night">
            {photo.kind === "sample" ? (
              <div
                aria-label={photo.title}
                role="img"
                className="flex aspect-square w-full max-w-xl items-center justify-center"
                style={photoArt(photo.variant)}
              >
                <p className="rounded-full border border-white/15 bg-night/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
                  Sample artwork
                </p>
              </div>
            ) : (
              <img
                src={photo.url}
                alt={photo.title}
                className="max-h-[62vh] w-full object-contain"
              />
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-display text-[15px] font-semibold">
                {photo.title}
              </p>
              <p className="text-xs text-faint">{caption}</p>
            </div>
            {photo.kind === "local" && (
              <p className="text-xs text-muted">
                {photo.fileName} · {formatFileSize(photo.fileSize)}
              </p>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
