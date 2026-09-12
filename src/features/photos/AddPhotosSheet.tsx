import { useEffect, useRef, useState } from "react"

import type { LocalPhoto } from "@/types/models"
import { PHASE_META } from "@/config/labels"
import { Modal } from "@/components/ui/Modal"
import { Segmented } from "@/components/ui/Segmented"
import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import { formatFileSize } from "@/features/photos/PhotoArt"

const MAX_PHOTOS = 20
const MAX_SIZE_MB = 10
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]

type Category = "jouvert" | "pretty-mas"

interface PendingFile {
  id: string
  name: string
  size: number
  url?: string
  error?: string
}

const makeId = () => `pending-${crypto.randomUUID()}`
const isValid = (p: PendingFile) => Boolean(p.url) && !p.error

export function AddPhotosSheet({
  open,
  onClose,
  defaultCategory,
  onAdd,
  remaining,
}: {
  open: boolean
  onClose: () => void
  defaultCategory: Category
  remaining: number
  onAdd: (photos: LocalPhoto[]) => void
}) {
  const [category, setCategory] = useState<Category>(defaultCategory)
  const [pending, setPending] = useState<PendingFile[]>([])
  const [overflowCount, setOverflowCount] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Track the latest list for the unmount cleanup below.
  const pendingRef = useRef<PendingFile[]>(pending)
  useEffect(() => {
    pendingRef.current = pending
  }, [pending])

  // Release every object URL when this sheet is torn down (it is remounted
  // on each open via a key change, so closing also triggers this).
  useEffect(() => {
    return () => revokeAll(pendingRef.current)
  }, [])

  const validCount = pending.filter(isValid).length
  const capacityLeft = remaining - validCount

  function addFiles(fileList: FileList | null) {
    const incoming = Array.from(fileList ?? [])
    if (incoming.length === 0) return

    {
      const current = pendingRef.current
      const additions: PendingFile[] = []
      let overflow = 0

      for (const file of incoming) {
        if (!ALLOWED_TYPES.includes(file.type)) {
          additions.push({
            id: makeId(),
            name: file.name,
            size: file.size,
            error: "Unsupported file type — use JPEG, PNG or WebP.",
          })
          continue
        }
        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
          additions.push({
            id: makeId(),
            name: file.name,
            size: file.size,
            error: `Larger than ${MAX_SIZE_MB} MB — choose a smaller copy.`,
          })
          continue
        }
        const validSoFar =
          current.filter(isValid).length +
          additions.filter(isValid).length
        if (validSoFar >= remaining) {
          overflow += 1
          continue
        }
        additions.push({
          id: makeId(),
          name: file.name,
          size: file.size,
          url: URL.createObjectURL(file),
        })
      }

      setOverflowCount((prev) => prev + overflow)
      pendingRef.current = [...current, ...additions]
      setPending(pendingRef.current)
    }
  }

  function removePending(file: PendingFile) {
    if (file.url) URL.revokeObjectURL(file.url)
    pendingRef.current = pendingRef.current.filter(p => p.id !== file.id)
    setPending(pendingRef.current)
  }

  function confirm() {
    const added: LocalPhoto[] = pending
      .filter(isValid)
      .map((p) => {
        const url = p.url as string
        return {
          id: `local-${crypto.randomUUID()}`,
          kind: "local" as const,
          category,
          title: p.name.replace(/\.[a-z0-9]+$/i, ""),
          url,
          fileName: p.name,
          fileSize: p.size,
          addedAt: new Date().toISOString(),
        }
      })
    // Ownership moves to the gallery before this sheet unmounts.
    pendingRef.current = []
    onAdd(added)
    setPending([])
    setOverflowCount(0)
  }

  const errorCount = pending.length - validCount

  return (
    <Modal open={open} onClose={onClose} title="Add photos" wide>
      <div className="space-y-5">
        <Segmented
          label="Choose which collection these photos belong to"
          options={[
            { value: "jouvert", label: PHASE_META.jouvert.label },
            { value: "pretty-mas", label: PHASE_META["pretty-mas"].label },
          ]}
          value={category}
          onChange={setCategory}
        />

        <div className="rounded-2xl border border-line bg-night/40 px-4 py-3">
          <p className="text-[13px] leading-relaxed text-muted">
            <span className="font-semibold text-ink">Local preview only.</span>{" "}
            Photos are not uploaded and will clear when you refresh.
          </p>
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-white/[0.03] text-[15px] font-semibold text-muted transition hover:border-gold/50 hover:text-gold"
        >
          <Icon name="image" className="size-5" />
          Choose photos… JPEG, PNG or WebP
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          aria-label="Choose photos from this device"
          onChange={(event) => {
            addFiles(event.target.files)
            event.target.value = ""
          }}
        />

        {pending.length > 0 && (
          <ul className="space-y-2" aria-label="Selected files">
            {pending.map((file) => (
              <li
                key={file.id}
                className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${
                  file.error
                    ? "border-danger/30 bg-danger/[0.06]"
                    : "border-line bg-white/[0.03]"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`grid size-10 shrink-0 place-items-center rounded-xl ${
                    file.error ? "bg-danger/15 text-danger" : "bg-teal/12 text-teal"
                  }`}
                >
                  <Icon name={file.error ? "warning" : "check"} className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-sm font-medium ${
                      file.error ? "text-danger" : "text-ink"
                    }`}
                  >
                    {file.name}
                  </p>
                  {file.error ? (
                    <p className="text-xs leading-snug text-danger">{file.error}</p>
                  ) : (
                    <p className="text-xs text-faint">{formatFileSize(file.size)}</p>
                  )}
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${file.name} from selection`}
                  onClick={() => removePending(file)}
                  className="grid size-11 shrink-0 place-items-center rounded-full text-muted transition hover:bg-white/[0.06] hover:text-ink"
                >
                  <Icon name="x" className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {errorCount > 0 && (
          <p className="text-xs leading-relaxed text-danger" role="alert">
            {errorCount} file{errorCount === 1 ? "" : "s"} need attention —
            fix the issues above or remove them from the list.
          </p>
        )}

        {overflowCount > 0 && (
          <p className="text-xs leading-relaxed text-warn" role="alert">
            {overflowCount} extra file{overflowCount === 1 ? "" : "s"} skipped —
            you can select up to {MAX_PHOTOS} photos at a time.
          </p>
        )}

        <p className="text-xs text-faint" aria-live="polite">
          {validCount} of {MAX_PHOTOS} photos selected · {capacityLeft} remaining
        </p>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={validCount === 0}
            onClick={confirm}
            icon={<Icon name="check" className="size-4" />}
          >
            Add {validCount} photo{validCount === 1 ? "" : "s"} to{" "}
            {PHASE_META[category].shortLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function revokeAll(files: PendingFile[]) {
  for (const file of files) {
    if (file.url) URL.revokeObjectURL(file.url)
  }
}
