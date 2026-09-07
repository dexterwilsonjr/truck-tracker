import type { ReactNode } from "react"

import { Icon } from "@/components/ui/Icon"
import type { IconName } from "@/components/ui/Icon"

export function EmptyState({
  icon = "image",
  title,
  body,
  action,
}: {
  icon?: IconName
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-card border border-dashed border-line bg-white/[0.02] px-6 py-12 text-center">
      <span className="mb-2 grid size-12 place-items-center rounded-full bg-white/[0.05] text-faint">
        <Icon name={icon} className="size-6" />
      </span>
      <p className="font-display text-[15px] font-semibold text-ink">{title}</p>
      <p className="max-w-xs text-sm leading-relaxed text-muted">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
