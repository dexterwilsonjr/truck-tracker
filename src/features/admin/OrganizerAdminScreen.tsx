import { CrossSell } from "@/features/upsell/CrossSell"
import { Card } from "@/components/ui/Primitives"
import { Button } from "@/components/ui/Button"
import { useAuth } from "@/state/AuthProvider"
import { useBand } from "@/state/BandProvider"

export function OrganizerAdminScreen() {
  const { band } = useBand()
  const { user } = useAuth()

  return (
    <div className="space-y-6 motion-safe:animate-fade-up">
      <header>
        <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-gold">
          Organizer
        </p>
        <h1 className="mt-1 font-display text-[30px] font-bold tracking-tight">
          {band.name}
        </h1>
        <p className="mt-2 max-w-lg text-[15px] text-muted">
          Signed in as {user?.email}. Module tools land here when that package
          is on the plan and in the deploy. Until then, add to the plan from
          platform admin.
        </p>
      </header>
      <Card className="p-5">
        <p className="text-sm leading-relaxed text-muted">
          Marshal phone fallback, go-live, and announcements are part of later
          contracts. Demo admin stays on the sales demo only — never
          unauthenticated in production.
        </p>
        {user?.platformRole === "platform_admin" && (
          <Button to="/platform" className="mt-4">
            Platform entitlements
          </Button>
        )}
      </Card>
      <CrossSell />
    </div>
  )
}
