import { useState } from "react"
import type { ReactNode } from "react"
import { Link } from "react-router-dom"

import { MapPanel } from "@/features/tracker/MapPanel"
import { brand } from "@/config/brand"
import { useDemo } from "@/state/demo-context"
import { TRUCK_STATUS_META } from "@/config/labels"
import { Card, Chip, SectionLabel } from "@/components/ui/Primitives"
import { Button } from "@/components/ui/Button"
import { Segmented } from "@/components/ui/Segmented"
import { Modal } from "@/components/ui/Modal"
import { Icon } from "@/components/ui/Icon"
import { BrandHero } from "@/components/brand/BrandVisuals"
import { relativeTime } from "@/utils/time"
import { useDemoHref } from "@/lib/demo-paths"

const STATUS_OPTIONS = [
  { value: "live" as const, label: "Live" },
  { value: "delayed" as const, label: "Delayed" },
  { value: "signal-lost" as const, label: "Signal lost" },
]

export function TrackerScreen() {
  const { snapshot, actions } = useDemo()
  const { truck, bandName, eventLabel, announcements } = snapshot
  const [showLocation, setShowLocation] = useState(false)
  const guideHref = useDemoHref("/guide")
  const updatesHref = useDemoHref("/updates")

  const pinned = announcements
    .filter((a) => a.pinned)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0]

  const jouvertMeeting = snapshot.phases.find((p) => p.id === "jouvert")
  const meeting = jouvertMeeting?.meeting

  return (
    <div className="space-y-6 motion-safe:animate-fade-up">
      {/* Hero */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold tracking-[0.14em] text-gold uppercase">
            {bandName} · {eventLabel}
          </p>
          <h1 className="mt-1.5 font-display text-[34px] leading-none font-bold tracking-tight text-balance sm:text-4xl">
            {brand.heroTitle}
          </h1>
          <p className="mt-2.5 max-w-md text-[15px] leading-relaxed text-muted">
            Follow {truck.truckName}, read the latest word and get to the
            meet-up on time.
          </p>
        </div>
        {brand.id === "original" && (
          <Chip tone="gold" dot={false}>
            Prototype build
          </Chip>
        )}
      </header>
      <BrandHero alt={bandName} />

      {/* Map */}
      <section
        aria-label="Truck location map"
        className="overflow-hidden rounded-card border border-line bg-panel shadow-card"
      >
        <MapPanel />
      </section>

      {/* Actions */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          size="lg"
          icon={<Icon name="gps" className="size-5" />}
          onClick={() => setShowLocation(true)}
        >
          Show my location
        </Button>
        {meeting && (
          <Button
            size="lg"
            variant="secondary"
            icon={<Icon name="calendar" className="size-5" />}
            to={guideHref}
          >
            Meeting details
          </Button>
        )}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Left: status + pinned */}
        <div className="space-y-6">
          <TruckStatusCard />
          {pinned && (
            <Card className="p-5">
              <div className="flex items-start gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gold/12 text-gold">
                  <Icon name="megaphone" className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold">
                    Pinned announcement
                  </p>
                  <h2 className="mt-1 font-display text-[17px] font-bold leading-snug">
                    {pinned.title}
                  </h2>
                  <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted">
                    {pinned.body}
                  </p>
                  <p className="mt-2 text-xs text-faint">
                    {relativeTime(pinned.publishedAt)}
                  </p>
                  <Link
                    to={`${updatesHref}/${pinned.id}`}
                    className="-my-1.5 mt-1 inline-flex h-11 items-center gap-1 rounded-full pr-2 text-[13px] font-semibold text-gold hover:bg-gold/10"
                  >
                    Read update
                    <Icon name="chevron-right" className="size-4" />
                  </Link>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Right: meeting snapshot + demo signal control */}
        <div className="space-y-6">
          {meeting && (
            <Card className="p-5">
              <SectionLabel>Meet-up</SectionLabel>
              <div className="mt-4 space-y-3.5 text-sm">
                <MeetingRow
                  icon="calendar"
                  label={meeting.dateLabel}
                  chip={
                    meeting.confirmed ? (
                      <Chip tone="live">Confirmed</Chip>
                    ) : (
                      <Chip tone="warn">Dates TBC</Chip>
                    )
                  }
                />
                <MeetingRow icon="clock" label={meeting.timeLabel} />
                <MeetingRow icon="map-pin" label={meeting.location} />
              </div>
              <Button
                variant="secondary"
                fullWidth
                className="mt-5"
                to={guideHref}
                icon={<Icon name="chevron-right" className="size-4" />}
              >
                Full schedule & guide
              </Button>
            </Card>
          )}

          {/* Demo signal control */}
          <Card className="p-5">
            <SectionLabel>Demo signal control</SectionLabel>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              Switch the demo status to preview how the app reacts.
            </p>
            <div className="mt-3">
              <Segmented
                label="Demo truck status"
                options={STATUS_OPTIONS}
                value={truck.status}
                onChange={(status) => {
                  void actions.setTruckStatus(status)
                }}
              />
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-faint">
              Demo only — this never simulates a real truck position and is not
              connected to GPS.
            </p>
          </Card>
        </div>
      </div>

      <Modal
        open={showLocation}
        onClose={() => setShowLocation(false)}
        title="Show my location"
      >
        <div className="space-y-4">
          <span className="grid size-12 place-items-center rounded-full bg-teal/12 text-teal">
            <Icon name="gps" className="size-6" />
          </span>
          <div className="space-y-3 text-[15px] leading-relaxed text-muted">
            <p>
              This prototype never asks for — or receives — your device
              location. No permission pop-up will appear.
            </p>
            <p>
              In the live app this button centres the map on you, shows your
              distance to {truck.truckName}, and only ever runs with your
              permission.
            </p>
          </div>
          <Button fullWidth onClick={() => setShowLocation(false)}>
            Got it
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function TruckStatusCard() {
  const { snapshot } = useDemo()
  const truck = snapshot.truck
  const meta = TRUCK_STATUS_META[truck.status]

  return (
    <Card className="p-5">
      <div
        aria-live={
          truck.status === "signal-lost" || truck.status === "delayed"
            ? "assertive"
            : "polite"
        }
      >
      <div className="flex items-center gap-4">
        <span
          className={`grid size-12 shrink-0 place-items-center rounded-2xl ${
            meta.tone === "live"
              ? "bg-live/12 text-live"
              : meta.tone === "warn"
                ? "bg-warn/12 text-warn"
                : "bg-danger/12 text-danger"
          }`}
        >
          <Icon name="truck" className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-xl font-bold tracking-tight">
              {truck.truckName}
            </h2>
            <Chip tone={meta.tone} dot>
              {meta.label}
            </Chip>
          </div>
          <p className="mt-1 text-sm text-muted">
            Updated {relativeTime(truck.lastUpdateISO)}
          </p>
        </div>
      </div>
      <p className="mt-4 rounded-2xl border border-line bg-night/40 px-4 py-3 text-[15px] leading-relaxed text-ink">
        {truck.message}
      </p>
      </div>
    </Card>
  )
}

function MeetingRow({
  icon,
  label,
  chip,
}: {
  icon: "calendar" | "clock" | "map-pin"
  label: string
  chip?: ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon name={icon} className="mt-0.5 size-4 shrink-0 text-gold" />
      <p className="min-w-0 flex-1 text-ink">{label}</p>
      {chip && <span className="shrink-0">{chip}</span>}
    </div>
  )
}
