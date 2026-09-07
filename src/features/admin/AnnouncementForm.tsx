import { useState } from "react"

import { useDemo } from "@/state/demo-context"
import { CATEGORY_ORDER, ANNOUNCEMENT_CATEGORIES } from "@/config/labels"
import type { AnnouncementCategory } from "@/types/models"
import { Card, SectionLabel } from "@/components/ui/Primitives"
import { Segmented } from "@/components/ui/Segmented"
import { TextField, TextAreaField } from "@/components/ui/Field"
import { ToggleRow } from "@/components/ui/Toggle"
import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"

const CATEGORY_OPTIONS: { value: AnnouncementCategory; label: string }[] =
  CATEGORY_ORDER.map((value) => ({
    value,
    label: ANNOUNCEMENT_CATEGORIES[value].label,
  }))

export function AnnouncementForm() {
  const { actions, busy } = useDemo()
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [category, setCategory] = useState<AnnouncementCategory>("general")
  const [pinned, setPinned] = useState(false)
  const [errors, setErrors] = useState<{ title?: string; body?: string }>({})
  const [posted, setPosted] = useState(false)

  function submit() {
    const nextErrors: typeof errors = {}
    if (!title.trim()) nextErrors.title = "Add a short headline."
    if (!body.trim()) nextErrors.body = "Write the announcement message."
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    void actions
      .addAnnouncement({
        category,
        title: title.trim(),
        body: body.trim(),
        pinned,
      })
      .then(() => {
        setTitle("")
        setBody("")
        setPinned(false)
        setPosted(true)
        window.setTimeout(() => setPosted(false), 2400)
      })
  }

  return (
    <Card className="p-5">
      <SectionLabel>Post an announcement</SectionLabel>
      <div className="mt-4 space-y-4">
        <Segmented
          label="Announcement category"
          options={CATEGORY_OPTIONS}
          value={category}
          onChange={setCategory}
        />
        <TextField
          label="Headline"
          value={title}
          error={errors.title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Collection moved to Saturday"
        />
        <TextAreaField
          label="Message"
          rows={4}
          value={body}
          error={errors.body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What do patrons need to know?"
        />
        <div className="rounded-2xl border border-line bg-night/30">
          <ToggleRow
            title="Pin this announcement"
            caption="Shown at the top of Updates and on the Tracker."
            checked={pinned}
            onChange={setPinned}
          />
        </div>
        <Button
          fullWidth
          busy={busy}
          onClick={submit}
          icon={<Icon name="plus" className="size-4" />}
        >
          Post announcement
        </Button>
        {posted && (
          <p className="flex items-center gap-1.5 text-sm font-semibold text-live" aria-live="polite">
            <Icon name="check" className="size-4" /> Posted — patrons see it on
            this device now.
          </p>
        )}
      </div>
    </Card>
  )
}
