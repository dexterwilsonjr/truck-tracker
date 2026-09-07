import type { ToneMeta } from "@/config/labels"

export interface SegmentOption<T extends string> {
  value: T
  label: string
  tone?: ToneMeta["tone"]
}

/**
 * Single-choice pill control (filters, tabs, truck status).
 * Controlled component; radiogroup semantics for screen readers.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className = "",
}: {
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  /** Accessible name describing what the control chooses. */
  label: string
  className?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`inline-flex w-full gap-1 rounded-full border border-line bg-night/70 p-1 ${className}`}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={[
              "h-11 min-w-0 flex-1 rounded-full px-3 text-sm font-medium transition",
              "focus-visible:outline-2",
              selected
                ? "bg-white/[0.09] text-ink ring-1 ring-inset ring-white/10"
                : "text-muted hover:bg-white/[0.04] hover:text-ink",
            ].join(" ")}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
