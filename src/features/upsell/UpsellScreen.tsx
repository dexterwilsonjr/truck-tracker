import { Link, useParams } from "react-router-dom"

import type { ModuleCode } from "@/config/modules"
import { isModuleCode } from "@/config/modules"
import { UPSELL_CATALOG } from "@/features/upsell/catalog"
import { CrossSell, MODULE_ICONS } from "@/features/upsell/CrossSell"
import { useOptionalBand } from "@/state/BandProvider"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Primitives"
import { Icon } from "@/components/ui/Icon"

export function UpsellScreen({ module }: { module: ModuleCode }) {
  const band = useOptionalBand()
  const copy = band?.band.upsells[module] ?? UPSELL_CATALOG[module]
  const coming = band?.comingOnline(module) ?? false
  const organizer = band?.isOrganizer ?? false
  const voice = coming
    ? copy.comingOnline
    : organizer
      ? copy.organizer
      : copy.patron
  const cta = coming
    ? "Coming online"
    : organizer
      ? copy.organizer.cta
      : copy.patron.cta

  return (
    <div className="space-y-8 motion-safe:animate-fade-up">
      <Card className="p-6 sm:p-8">
        <span className="grid size-14 place-items-center rounded-2xl bg-gold/12 text-gold">
          <Icon name={MODULE_ICONS[module]} className="size-7" />
        </span>
        <h1 className="mt-5 font-display text-[30px] font-bold leading-none tracking-tight sm:text-4xl">
          {voice.headline}
        </h1>
        <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-muted">
          {voice.body}
        </p>
        <Button className="mt-6" size="lg" disabled>
          {cta}
        </Button>
        {organizer && !coming && (
          <p className="mt-3 text-[13px] text-faint">
            Turn this on from{" "}
            <Link
              to="/platform"
              className="font-semibold text-gold underline decoration-dotted underline-offset-4"
            >
              platform admin
            </Link>{" "}
            after the contract is live.
          </p>
        )}
        <p className="mt-4 text-[12px] text-faint">
          <Link
            to="/privacy"
            className="underline decoration-dotted underline-offset-4"
          >
            Privacy
          </Link>
        </p>
      </Card>
      <CrossSell exclude={module} />
    </div>
  )
}

export function ModuleUpsellRoute() {
  const { moduleCode } = useParams()
  const code = moduleCode && isModuleCode(moduleCode) ? moduleCode : "truck_tracker"
  return <UpsellScreen module={code} />
}
