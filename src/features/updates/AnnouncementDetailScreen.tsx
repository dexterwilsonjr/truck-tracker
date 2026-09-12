import { useEffect } from "react"
import { Link, useParams } from "react-router-dom"

import { useDemo } from "@/state/demo-context"
import { ANNOUNCEMENT_CATEGORIES } from "@/config/labels"
import { Card, Chip } from "@/components/ui/Primitives"
import { EmptyState } from "@/components/ui/EmptyState"
import { Icon } from "@/components/ui/Icon"
import { Button } from "@/components/ui/Button"
import { relativeTime } from "@/utils/time"
import { useDemoHref } from "@/lib/demo-paths"

export function AnnouncementDetailScreen() {
  const { snapshot, actions } = useDemo()
  const { id } = useParams<{ id: string }>()
  const announcement = snapshot.announcements.find((a) => a.id === id)
  const updatesHref = useDemoHref("/updates")

  const alreadyRead = announcement
    ? snapshot.readIds.includes(announcement.id)
    : true

  useEffect(() => {
    if (announcement && !alreadyRead) {
      // Opening an announcement marks it as read locally.
      void actions.markAnnouncementRead(announcement.id)
    }
  }, [announcement, alreadyRead, actions])

  if (!announcement) {
    return (
      <div className="space-y-6 motion-safe:animate-fade-up">
        <EmptyState
          icon="megaphone"
          title="Update not found"
          body="This announcement may have been removed, or the link is stale."
          action={
            <Button to={updatesHref} variant="secondary">
              Back to updates
            </Button>
          }
        />
      </div>
    )
  }

  const category = ANNOUNCEMENT_CATEGORIES[announcement.category]
  const fullDate = new Date(announcement.publishedAt).toLocaleString([], {
    dateStyle: "full",
    timeStyle: "short",
  })

  return (
    <article className="mx-auto max-w-2xl space-y-5 motion-safe:animate-fade-up">
      <Link
        to={updatesHref}
        className="inline-flex h-11 items-center gap-1.5 rounded-full pr-4 text-sm font-semibold text-muted transition hover:bg-white/[0.05] hover:text-ink"
      >
        <Icon name="chevron-left" className="size-4" />
        All updates
      </Link>

      <Card className="p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={category.tone} dot>
            {category.label}
          </Chip>
          {announcement.pinned && (
            <Chip tone="gold">Pinned</Chip>
          )}
          {announcement.sample && (
            <span className="rounded-full border border-line px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-faint">
              Sample content
            </span>
          )}
        </div>

        <h1 className="mt-4 font-display text-2xl leading-tight font-bold tracking-tight text-balance sm:text-[28px]">
          {announcement.title}
        </h1>
        <p className="mt-2 text-[13px] text-faint">
          {fullDate} · posted {relativeTime(announcement.publishedAt)}
        </p>

        <div className="mt-6 space-y-4 text-[15px] leading-[1.75] text-ink/90">
          {announcement.body.split("\n").map((paragraph, index) =>
            paragraph.trim() ? <p key={index}>{paragraph}</p> : null,
          )}
        </div>
      </Card>

      <p className="px-2 text-xs leading-relaxed text-faint">
        Opened updates are marked as read on this device only. Announcements
        shown here are sample content unless posted from the demo admin.
      </p>
    </article>
  )
}
