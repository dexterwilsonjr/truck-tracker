/**
 * Full-width row switch with a large touch target; the whole row toggles.
 */
export function ToggleRow({
  title,
  caption,
  checked,
  onChange,
}: {
  title: string
  caption?: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="group flex min-h-[52px] w-full items-center justify-between gap-4 rounded-2xl px-4 py-3 text-left transition hover:bg-white/[0.04] focus-visible:outline-2"
    >
      <span className="min-w-0">
        <span className="block text-[15px] font-medium text-ink">{title}</span>
        {caption && (
          <span className="mt-0.5 block text-[13px] leading-snug text-muted">
            {caption}
          </span>
        )}
      </span>
      <span
        aria-hidden="true"
        className={`relative inline-flex h-7 w-12 shrink-0 rounded-full border transition-colors ${
          checked ? "border-gold/60 bg-gold" : "border-line bg-raised"
        }`}
      >
        <span
          className={`absolute top-1/2 size-5 -translate-y-1/2 rounded-full transition-transform ${
            checked ? "left-6 bg-goldink" : "left-1 bg-muted"
          }`}
        />
      </span>
    </button>
  )
}
