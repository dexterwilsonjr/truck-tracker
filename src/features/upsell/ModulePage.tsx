import type { ReactNode } from "react"

import type { ModuleCode } from "@/config/modules"
import { UpsellScreen } from "@/features/upsell/UpsellScreen"
import { useBand } from "@/state/band-context"

/**
 * V1: every SKU renders the upsell unless entitled and the package is in
 * this deploy. Live screens swap in later behind the same route.
 */
export function ModulePage({
  module,
  children,
}: {
  module: ModuleCode
  children?: ReactNode
}) {
  const { moduleLive } = useBand()
  if (moduleLive(module) && children) return children
  return <UpsellScreen module={module} />
}
