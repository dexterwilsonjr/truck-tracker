import type { CSSProperties } from "react"

/**
 * Placeholder artwork used until real band photos exist: layered gradients
 * and a diagonal weave, derived from the brand palette. Never passes itself
 * off as a photograph — each tile carries a "sample" title.
 */
export function photoArt(variant: number): CSSProperties {
  const roots = [
    "var(--color-gold)",
    "var(--color-teal)",
    "var(--color-sky)",
    "var(--color-warn)",
  ]
  const root = roots[variant % roots.length] ?? "var(--color-teal)"
  const companion = roots[(variant + 2) % roots.length] ?? "var(--color-gold)"
  const angle = 105 + variant * 31

  return {
    backgroundColor: "var(--color-raised)",
    backgroundImage: [
      `radial-gradient(120% 90% at 15% 0%, color-mix(in srgb, ${root} 34%, transparent), transparent 58%)`,
      `radial-gradient(100% 80% at 88% 100%, color-mix(in srgb, ${companion} 22%, transparent), transparent 55%)`,
      `linear-gradient(${angle}deg, color-mix(in srgb, ${root} 26%, transparent), transparent 72%)`,
      `repeating-linear-gradient(118deg, rgb(255 255 255 / 0.05) 0 2px, transparent 2px 30px)`,
    ].join(", "),
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}
