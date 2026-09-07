import { useEffect, useRef } from "react"
import type { ReactNode } from "react"

import { Icon } from "@/components/ui/Icon"

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Accessible modal: Escape closes, focus is trapped inside, the opener
 * regains focus on close, scroll behind is locked. Mobile: bottom sheet;
 * sm and up: centred dialog.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean
  onClose: () => void
  /** Accessible dialog title, rendered in the header. */
  title: string
  children: ReactNode
  wide?: boolean
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null

    const dialog = panelRef.current
    dialog?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== "Tab" || !dialog) return

      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null)
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (!first || !last) return

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6"
      role="presentation"
    >
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-night/80 backdrop-blur-sm motion-safe:animate-fade-in"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        className={[
          "relative z-10 flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-[24px] border border-line bg-panel shadow-card",
          "sm:rounded-card motion-safe:animate-scale-in",
          wide ? "sm:max-w-2xl" : "sm:max-w-md",
        ].join(" ")}
      >
        <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <h2
            id="modal-title"
            className="min-w-0 truncate font-display text-lg font-bold"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="grid size-11 shrink-0 place-items-center rounded-full text-muted transition hover:bg-white/[0.07] hover:text-ink"
          >
            <Icon name="x" className="size-5" />
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  )
}
