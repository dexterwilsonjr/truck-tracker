import { useState } from "react"

import { useDemo } from "@/state/demo-context"
import { PHASE_META } from "@/config/labels"
import type { MeetingOverrides, PhaseId } from "@/types/models"
import { Card, Divider, SectionLabel } from "@/components/ui/Primitives"
import { Segmented } from "@/components/ui/Segmented"
import { TextField } from "@/components/ui/Field"
import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"

type ConfirmChoice = "tbc" | "confirmed"

export function EventInfoForm() {
  const { snapshot, actions, busy } = useDemo()
  const [bandName, setBandName] = useState(snapshot.bandName)
  const [eventLabel, setEventLabel] = useState(snapshot.eventLabel)
  const [meetings, setMeetings] = useState(() =>
    Object.fromEntries(
      snapshot.phases.map((phase) => [
        phase.id,
        {
          dateLabel: phase.meeting.dateLabel,
          timeLabel: phase.meeting.timeLabel,
          location: phase.meeting.location,
          confirm: (phase.meeting.confirmed
            ? "confirmed"
            : "tbc") as ConfirmChoice,
        },
      ]),
    ) as Record<PhaseId, { dateLabel: string; timeLabel: string; location: string; confirm: ConfirmChoice }>,
  )
  const [saved, setSaved] = useState(false)

  function save() {
    void actions
      .saveMeta({ bandName, eventLabel })
      .then(async () => {
        for (const phase of snapshot.phases) {
          const m = meetings[phase.id]
          if (!m) continue
          const overrides: MeetingOverrides = {
            dateLabel: m.dateLabel,
            timeLabel: m.timeLabel,
            location: m.location,
            confirmed: m.confirm === "confirmed",
          }
          await actions.saveMeetingOverrides(phase.id, overrides)
        }
      })
      .then(() => {
        setSaved(true)
        window.setTimeout(() => setSaved(false), 2400)
      })
  }

  return (
    <Card className="p-5">
      <SectionLabel>Event information</SectionLabel>
      <div className="mt-4 space-y-4">
        <TextField
          label="Band display name"
          value={bandName}
          onChange={(e) => setBandName(e.target.value)}
          hint="Shown across the patron app."
        />
        <TextField
          label="Event label"
          value={eventLabel}
          onChange={(e) => setEventLabel(e.target.value)}
          hint="e.g. J'ouvert & Pretty Mas 2026."
        />

        <Divider />

        {snapshot.phases.map((phase) => {
          const m = meetings[phase.id]
          if (!m) return null
          return (
            <fieldset key={phase.id} className="space-y-4">
              <p className="text-[13px] font-bold uppercase tracking-[0.12em] text-gold">
                {PHASE_META[phase.id].label} meet-up
              </p>
              <TextField
                label="Location"
                value={m.location}
                onChange={(e) =>
                  setMeetings((prev) => ({
                    ...prev,
                    [phase.id]: { ...m, location: e.target.value },
                  }))
                }
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Date label"
                  value={m.dateLabel}
                  onChange={(e) =>
                    setMeetings((prev) => ({
                      ...prev,
                      [phase.id]: { ...m, dateLabel: e.target.value },
                    }))
                  }
                />
                <TextField
                  label="Time label"
                  value={m.timeLabel}
                  onChange={(e) =>
                    setMeetings((prev) => ({
                      ...prev,
                      [phase.id]: { ...m, timeLabel: e.target.value },
                    }))
                  }
                />
              </div>
              <Segmented
                label={`${PHASE_META[phase.id].label} dates confirmed`}
                options={[
                  { value: "tbc", label: "Dates TBC" },
                  { value: "confirmed", label: "Confirmed" },
                ]}
                value={m.confirm}
                onChange={(confirm) =>
                  setMeetings((prev) => ({
                    ...prev,
                    [phase.id]: { ...m, confirm },
                  }))
                }
              />
            </fieldset>
          )
        })}

        <Button
          fullWidth
          busy={busy}
          onClick={save}
          icon={<Icon name="check" className="size-4" />}
        >
          Save event info
        </Button>
        {saved && (
          <p className="flex items-center gap-1.5 text-sm font-semibold text-live" aria-live="polite">
            <Icon name="check" className="size-4" /> Saved — Tracker and Guide
            now show these details.
          </p>
        )}
      </div>
    </Card>
  )
}
