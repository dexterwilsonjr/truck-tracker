import { useEffect, useRef, useState } from "react"

import { useDemo } from "@/state/demo-context"
import { demoAdminEnabled } from "@/features/admin/gate"
import { AnnouncementForm } from "@/features/admin/AnnouncementForm"
import { EventInfoForm } from "@/features/admin/EventInfoForm"
import { TruckControls } from "@/features/admin/TruckControls"
import { Card, Chip, Divider, SectionLabel } from "@/components/ui/Primitives"
import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import { relativeTime } from "@/utils/time"
import { CrossSell } from "@/features/upsell/CrossSell"
import { useDemoHref } from "@/lib/demo-paths"

export function AdminScreen() {
  if (!demoAdminEnabled()) {
    return <AdminDisabled />
  }
  return <AdminWorkspace />
}

function AdminWorkspace() {
  return (
    <div className="space-y-6 motion-safe:animate-fade-up">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-[13px] font-semibold text-danger">
              <Icon name="warning" className="size-4" />
              Demo admin — no authentication
            </p>
            <h1 className="mt-1 font-display text-[30px] leading-none font-bold tracking-tight sm:text-4xl">
              Admin preview
            </h1>
          </div>
          <Chip tone="warn">Local-only</Chip>
        </div>
        <p className="rounded-2xl border border-danger/25 bg-danger/[0.06] px-4 py-3 text-[13px] leading-relaxed text-danger">
          Do not enter private information. This route is not a security
          boundary — edits live in this browser only and are disabled in
          production builds by default.
        </p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <EventInfoForm />
          <TruckControls />
        </div>
        <div className="space-y-6">
          <AnnouncementForm />
          <SampleOverview />
          <ResetPanel />
        </div>
      </div>
      <CrossSell />
    </div>
  )
}

function SampleOverview() {
  const { snapshot } = useDemo()
  const readCount = snapshot.readIds.length
  const adminAdded = snapshot.announcements.filter((a) => !a.sample).length
  const confirmedPhases = snapshot.phases.filter((p) => p.meeting.confirmed)

  const rows: { label: string; value: string }[] = [
    { label: "Announcements", value: `${snapshot.announcements.length} total` },
    { label: "Read on this device", value: `${readCount} of ${snapshot.announcements.length}` },
    { label: "Posted from admin", value: String(adminAdded) },
    { label: "Truck", value: snapshot.truck.truckName },
    {
      label: "Meet-ups confirmed",
      value:
        confirmedPhases.length === 0
          ? "None yet — all TBC"
          : `${confirmedPhases.length} confirmed`,
    },
  ]

  return (
    <Card className="p-5">
      <SectionLabel>Sample content overview</SectionLabel>
      <p className="mt-2 text-[13px] text-muted">
        Everything patrons see is seeded sample content until a real backend
        connects.
      </p>
      <Divider className="my-4" />
      <dl className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-baseline justify-between gap-4 text-sm"
          >
            <dt className="text-muted">{row.label}</dt>
            <dd className="text-right font-semibold text-ink">{row.value}</dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-4 text-sm">
          <dt className="text-muted">Last truck update</dt>
          <dd className="text-right font-semibold text-ink">
            {relativeTime(snapshot.truck.lastUpdateISO)}
          </dd>
        </div>
      </dl>
    </Card>
  )
}

function ResetPanel() {
  const { actions, busy } = useDemo()
  const [armed, setArmed] = useState(false)
  const [done, setDone] = useState(false)
  const resetTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    return () => window.clearTimeout(resetTimer.current)
  }, [])

  function handleReset() {
    if (!armed) {
      setArmed(true)
      resetTimer.current = window.setTimeout(() => setArmed(false), 4000)
      return
    }
    window.clearTimeout(resetTimer.current)
    setArmed(false)
    void actions.resetDemo().then(() => {
      setDone(true)
      window.setTimeout(() => setDone(false), 3000)
    })
  }

  return (
    <Card className="p-5">
      <SectionLabel>Demo data</SectionLabel>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">
        Clears every local demo edit — announcements you posted, renamed
        trucks, event info and read markers — and restores the seeded sample
        content. Your photo previews live in memory only and are always cleared
        on refresh.
      </p>
      <Button
        variant="danger"
        fullWidth
        busy={busy}
        className="mt-4"
        onClick={handleReset}
        icon={<Icon name={armed ? "warning" : "refresh"} className="size-4" />}
      >
        {armed ? "Tap again to confirm reset" : "Reset demo data"}
      </Button>
      {done && (
        <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-live" aria-live="polite">
          <Icon name="check" className="size-4" /> Demo data reset to sample
          content.
        </p>
      )}
    </Card>
  )
}

function AdminDisabled() {
  const home = useDemoHref("/")
  return (
    <div className="space-y-6 motion-safe:animate-fade-up">
      <Card className="p-6 sm:p-8">
        <span className="grid size-12 place-items-center rounded-full bg-white/[0.06] text-muted">
          <Icon name="warning" className="size-6" />
        </span>
        <h1 className="mt-4 font-display text-2xl font-bold tracking-tight">
          Admin demo disabled in this build
        </h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
          The demo admin only ships in development builds. Set{" "}
          <code className="rounded bg-night/60 px-1.5 py-0.5 text-xs text-gold">
            VITE_ENABLE_DEMO_ADMIN="true"
          </code>{" "}
          to preview it in a production build.
        </p>
        <Button to={home} variant="secondary" className="mt-6">
          Back to tracker
        </Button>
      </Card>
      <p className="text-xs text-faint">
        Hiding this route is not a security measure — it simply keeps demo
        tooling out of shipped builds.
      </p>
    </div>
  )
}
