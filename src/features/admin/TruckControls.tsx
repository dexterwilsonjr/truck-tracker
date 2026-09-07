import { useState } from "react"

import { useDemo } from "@/state/demo-context"
import { TRUCK_STATUS_META } from "@/config/labels"
import { Card, Chip, Divider, SectionLabel } from "@/components/ui/Primitives"
import { Segmented } from "@/components/ui/Segmented"
import { TextField } from "@/components/ui/Field"
import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import { relativeTime } from "@/utils/time"

const STATUS_OPTIONS = [
  { value: "live" as const, label: "Live" },
  { value: "delayed" as const, label: "Delayed" },
  { value: "signal-lost" as const, label: "Signal lost" },
]

export function TruckControls() {
  const { snapshot, actions, busy } = useDemo()
  const truck = snapshot.truck
  const meta = TRUCK_STATUS_META[truck.status]
  const [name, setName] = useState(truck.truckName)
  const [renamed, setRenamed] = useState(false)

  function rename() {
    void actions.setTruckName(name).then(() => {
      setRenamed(true)
      window.setTimeout(() => setRenamed(false), 2400)
    })
  }

  return (
    <Card className="p-5">
      <SectionLabel>Truck status — demo</SectionLabel>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">
        Changes the truck's state everywhere in the patron app on this device.
        Never simulates a real position.
      </p>

      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-line bg-night/30 px-4 py-3">
        <Icon name="truck" className="size-5 text-gold" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {truck.truckName}
            <span className="ml-2 text-xs font-normal text-faint">
              updated {relativeTime(truck.lastUpdateISO)}
            </span>
          </p>
        </div>
        <Chip tone={meta.tone} dot>
          {meta.label}
        </Chip>
      </div>

      <div className="mt-4">
        <Segmented
          label="Set demo truck status"
          options={STATUS_OPTIONS}
          value={truck.status}
          onChange={(status) => {
            void actions.setTruckStatus(status)
          }}
        />
      </div>
      <p className="mt-3 text-xs text-faint">{meta.blurb}</p>

      <Divider className="my-5" />

      <div className="space-y-3">
        <TextField
          label="Truck name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            busy={busy}
            onClick={rename}
            icon={<Icon name="pencil" className="size-4" />}
          >
            Rename truck
          </Button>
          {renamed && (
            <p className="flex items-center gap-1 text-sm font-semibold text-live" aria-live="polite">
              <Icon name="check" className="size-4" /> Saved
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}
