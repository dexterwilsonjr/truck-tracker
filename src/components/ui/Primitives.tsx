import type { ReactNode } from "react"

import type { ToneMeta } from "@/config/labels"

const TONE_STYLES: Record<ToneMeta["tone"], { chip: string; dot: string }> = {
  gold: { chip: "bg-gold/12 text-gold border-gold/30", dot: "bg-gold" },
  teal: { chip: "bg-teal/12 text-teal border-teal/30", dot: "bg-teal" },
  sky: { chip: "bg-sky/12 text-sky border-sky/30", dot: "bg-sky" },
  live: { chip: "bg-live/12 text-live border-live/30", dot: "bg-live" },
  warn: { chip: "bg-warn/12 text-warn border-warn/30", dot: "bg-warn" },
  danger: {
    chip: "bg-danger/12 text-danger border-danger/30",
    dot: "bg-danger",
  },
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-card border border-line bg-panel ${className}`}>
      {children}
    </section>
  )
}

/** Small pill used for category / status labels. */
export function Chip({
  tone = "teal",
  dot = true,
  children,
  className = "",
}: {
  tone?: ToneMeta["tone"]
  dot?: boolean
  children: ReactNode
  className?: string
}) {
  const styles = TONE_STYLES[tone]
  return (
    <span
      className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold tracking-wide ${styles.chip} ${className}`}
    >
      {dot && <span aria-hidden="true" className={`size-1.5 rounded-full ${styles.dot}`} />}
      {children}
    </span>
  )
}

/** Uppercase eyebrow used above section headings. */
export function SectionLabel({
  children,
  className = "",
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <p
      className={`text-[11px] font-semibold uppercase tracking-[0.16em] text-faint ${className}`}
    >
      {children}
    </p>
  )
}

export function Divider({ className = "" }: { className?: string }) {
  return <hr aria-hidden="true" className={`border-t border-line ${className}`} />
}
