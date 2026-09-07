import { useState } from "react"
import type { CSSProperties } from "react"
import { Link } from "react-router-dom"

import { useDemo } from "@/state/demo-context"
import { ANNOUNCEMENT_CATEGORIES } from "@/config/labels"
import type { Announcement, AnnouncementCategory } from "@/types/models"
import { Card, Chip, Divider } from "@/components/ui/Primitives"
import { Segmented } from "@/components/ui/Segmented"
import { ToggleRow } from "@/components/ui/Toggle"
import { EmptyState } from "@/components/ui/EmptyState"
import { Icon } from "@/components/ui/Icon"
import { Button } from "@/components/ui/Button"
import { relativeTime } from "@/utils/time"

type Filter = "all" | AnnouncementCategory

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "general", label: "General" },
  { value: "collection", label: "Collection" },
  { value: "on-the-road", label: "On the road" },
]

export function UpdatesScreen() {
  const { snapshot, actions } = useDemo()
  const [filter, setFilter] = useState<Filter>("all")
  const [prefsSaved, setPrefsSaved] = useState(false)

  const readSet = new Set(snapshot.readIds)

  const visible = snapshot.announcements
    .filter((a) => filter === "all" || a.category === filter)
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return b.publishedAt.localeCompare(a.publishedAt)
    })

  return (
    <div className="space-y-6 motion-safe:animate-fade-up">
      <header>
        <h1 className="font-display text-[30px] leading-none font-bold tracking-tight sm:text-4xl">
          Updates
        </h1>
        <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-muted">
          Word from the road — announcements open automatically mark as read on
          this device.
        </p>
      </header>

      <Segmented
        label="Filter announcements by category"
        options={FILTERS}
        value={filter}
        onChange={setFilter}
      />

      {visible.length === 0 ? (
        <EmptyState
          icon="megaphone"
          title={`No ${filter === "all" ? "" : `${FILTERS.find((f) => f.value === filter)?.label} `}updates yet`}
          body="There's nothing in this category right now. Check back later or switch back to All."
          action={
            <Button variant="secondary" onClick={() => setFilter("all")}>
              Show all updates
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {visible.map((announcement, index) => (
            <AnnouncementRow
              key={announcement.id}
              announcement={announcement}
              read={readSet.has(announcement.id)}
              style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
            />
          ))}
        </div>
      )}

      <NotificationsCard
        checkedAnnouncements={snapshot.prefs.announcements}
        checkedTruck={snapshot.prefs.truckStatus}
        saved={prefsSaved}
        onAnnouncements={(next) => {
          void actions
            .savePrefs({ ...snapshot.prefs, announcements: next })
            .then(() => flashPrefsSaved(setPrefsSaved))
        }}
        onTruck={(next) => {
          void actions
            .savePrefs({ ...snapshot.prefs, truckStatus: next })
            .then(() => flashPrefsSaved(setPrefsSaved))
        }}
      />
    </div>
  )
}

function flashPrefsSaved(setSaved: (v: boolean) => void) {
  setSaved(true)
  window.setTimeout(() => setSaved(false), 2200)
}

function AnnouncementRow({
  announcement,
  read,
  style,
}: {
  announcement: Announcement
  read: boolean
  style?: CSSProperties
}) {
  const category = ANNOUNCEMENT_CATEGORIES[announcement.category]
  return (
    <Link
      to={`/updates/${announcement.id}`}
      style={style}
      className={[
        "block rounded-card border p-4 transition sm:p-5",
        "hover:bg-white/[0.03] focus-visible:outline-2",
        announcement.pinned
          ? "border-gold/35 bg-gold/[0.05]"
          : read
            ? "border-line bg-panel"
            : "border-line bg-panel",
        !read && !announcement.pinned && "ring-1 ring-inset ring-white/[0.07]",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {!read && !announcement.pinned && (
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full bg-gold motion-safe:animate-pulse-dot"
              />
            )}
            <h2 className="truncate font-display text-[16px] font-bold leading-snug sm:text-[17px]">
              {announcement.title}
            </h2>
          </div>
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted">
            {announcement.body}
          </p>
        </div>
        {!read && (
          <span className="sr-only">Unread</span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Chip tone={category.tone} dot>
          {category.label}
        </Chip>
        <span className="text-xs text-faint">
          {relativeTime(announcement.publishedAt)}
        </span>
        {announcement.pinned && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-gold">
            <Icon name="megaphone" className="size-3.5" />
            Pinned
          </span>
        )}
        {announcement.sample && (
          <span className="rounded-full border border-line px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-faint">
            Sample
          </span>
        )}
      </div>
    </Link>
  )
}

function NotificationsCard({
  checkedAnnouncements,
  checkedTruck,
  saved,
  onAnnouncements,
  onTruck,
}: {
  checkedAnnouncements: boolean
  checkedTruck: boolean
  saved: boolean
  onAnnouncements: (next: boolean) => void
  onTruck: (next: boolean) => void
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 px-5 pt-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-teal/12 text-teal">
          <Icon name="bell" className="size-5" />
        </span>
        <div>
          <h2 className="font-display text-[17px] font-bold">Notifications</h2>
          <p className="text-[13px] text-muted">Saved on this device only.</p>
        </div>
      </div>
      <Divider className="mt-4" />
      <div className="px-2">
        <ToggleRow
          title="New band announcements"
          caption="A nudge whenever the band posts an update."
          checked={checkedAnnouncements}
          onChange={onAnnouncements}
        />
        <ToggleRow
          title="Truck status changes"
          caption="Told when the truck goes delayed or loses signal."
          checked={checkedTruck}
          onChange={onTruck}
        />
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line bg-night/30 px-5 py-3">
        <p className="text-[12px] leading-snug text-faint">
          Demo preference only. Push notifications are not connected.
        </p>
        <span
          className={`inline-flex shrink-0 items-center gap-1 text-xs font-semibold transition ${
            saved ? "text-live" : "text-faint"
          }`}
          aria-live="polite"
        >
          {saved && <Icon name="check" className="size-3.5" />}
          {saved ? "Saved" : "Local only"}
        </span>
      </div>
    </Card>
  )
}
