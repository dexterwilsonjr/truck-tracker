import { useCallback, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"

import { demoApi } from "@/services/demoApi"
import { DemoContext } from "@/state/demo-context"
import type { DemoActions, DemoContextValue } from "@/state/demo-context"
import type {
  DemoSnapshot,
  MeetingOverrides,
  NotificationPrefs,
  PhaseId,
  TruckStatus,
} from "@/types/models"
import { Icon } from "@/components/ui/Icon"

type BootState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; snapshot: DemoSnapshot }

/**
 * Loads the demo snapshot once, then keeps every screen (patron + admin) in
 * sync by re-running the service layer on each mutation and swapping the
 * snapshot. localStorage stays the single persistence point.
 */
export function DemoProvider({ children }: { children: ReactNode }) {
  const [boot, setBoot] = useState<BootState>({ phase: "loading" })
  const [busy, setBusy] = useState(false)

  const runBoot = useCallback(async () => {
    try {
      const snapshot = await demoApi.loadDemo()
      setBoot({ phase: "ready", snapshot })
    } catch {
      setBoot({
        phase: "error",
        message:
          "The demo content could not be loaded from this device. Try again, or reset the demo data.",
      })
    }
  }, [])

  // Boot is async by design: the snapshot lands once demoApi resolves.
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- setState fires after the awaited fetch.
    void runBoot()
  }, [runBoot])

  function retry() {
    setBoot({ phase: "loading" })
    void runBoot()
  }

  function hardReset() {
    setBoot({ phase: "loading" })
    void demoApi.resetDemo().then(runBoot)
  }

  const run = useCallback(
    async (op: (snapshot: DemoSnapshot) => Promise<DemoSnapshot>) => {
      setBusy(true)
      try {
        const snapshot = await op(
          boot.phase === "ready" ? boot.snapshot : await demoApi.loadDemo(),
        )
        setBoot({ phase: "ready", snapshot })
      } catch {
        setBoot({
          phase: "error",
          message:
            "Something went wrong saving that change. It's a demo — try again, or reset the demo data.",
        })
      } finally {
        setBusy(false)
      }
    },
    [boot],
  )

  const actions = useMemo<DemoActions>(() => {
    return {
      addAnnouncement: (input) => run(() => demoApi.addAnnouncement(input)),
      markAnnouncementRead: (id) => run(() => demoApi.markAnnouncementRead(id)),
      setTruckStatus: (status: TruckStatus) =>
        run(() => demoApi.setTruckStatus(status)),
      setTruckName: (name) => run(() => demoApi.setTruckName(name)),
      saveMeetingOverrides: (phaseId: PhaseId, overrides: MeetingOverrides) =>
        run(() => demoApi.saveMeetingOverrides(phaseId, overrides)),
      saveMeta: (meta) => run(() => demoApi.saveMeta(meta)),
      savePrefs: (prefs: NotificationPrefs) =>
        run(() => demoApi.savePrefs(prefs)),
      resetDemo: () => run(() => demoApi.resetDemo()),
    }
  }, [run])

  const contextValue = useMemo<DemoContextValue | null>(() => {
    if (boot.phase !== "ready") return null
    return { snapshot: boot.snapshot, actions, busy }
  }, [boot, actions, busy])

  if (boot.phase === "error") {
    return <BootError message={boot.message} onRetry={retry} onReset={hardReset} />
  }

  if (!contextValue) {
    return <BootSplash />
  }

  return <DemoContext.Provider value={contextValue}>{children}</DemoContext.Provider>
}

function BootSplash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6">
      <LogoMark />
      <p className="text-sm text-muted">Loading demo content…</p>
    </div>
  )
}

function BootError({
  message,
  onRetry,
  onReset,
}: {
  message: string
  onRetry: () => void
  onReset: () => void
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-card border border-line bg-panel p-6 text-center shadow-card">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-danger/15 text-danger">
          <Icon name="warning" className="size-6" />
        </div>
        <h1 className="font-display text-lg font-bold">Demo data unavailable</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{message}</p>
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="h-11 rounded-full bg-gold font-semibold text-goldink transition hover:brightness-110"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={onReset}
            className="h-11 rounded-full border border-danger/40 bg-danger/10 text-sm font-semibold text-danger transition hover:bg-danger/20"
          >
            Reset demo data
          </button>
        </div>
      </div>
    </div>
  )
}

export function LogoMark({ size = 44 }: { size?: number }) {
  return (
    <span
      style={{ width: size, height: size }}
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-[calc(var(--radius-card)*0.55)] border border-gold/30 shadow-card motion-safe:animate-fade-in"
      aria-hidden="true"
    >
      <span
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(140deg, color-mix(in srgb, var(--color-gold) 85%, #ffffff), color-mix(in srgb, var(--color-gold) 40%, var(--color-night)))",
        }}
      />
      <Icon name="truck" className="relative size-1/2 text-goldink" strokeWidth={2.2} />
    </span>
  )
}
