import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { Navigate } from "react-router-dom"

import { MODULE_CODES } from "@/config/modules"
import type { ModuleCode } from "@/config/modules"
import { MODULE_TITLES } from "@/features/upsell/catalog"
import { useAuth } from "@/state/AuthProvider"
import { api } from "@/services/api"
import { Button } from "@/components/ui/Button"
import { Card, Chip } from "@/components/ui/Primitives"

interface PlatformBand {
  id: string
  slug: string
  name: string
  eventYear: number
  entitlements: ModuleCode[]
  liveModules: ModuleCode[]
}

interface PlatformUser {
  id: string
  email: string
  name: string
  platform_role: string
}

export function PlatformScreen() {
  const { user, ready } = useAuth()
  const [bands, setBands] = useState<PlatformBand[]>([])
  const [users, setUsers] = useState<PlatformUser[]>([])
  const [error, setError] = useState<string | null>(null)
  const [temp, setTemp] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!user || user.platformRole !== "platform_admin") return
    void Promise.all([
      api<{ bands: PlatformBand[] }>("/platform/bands"),
      api<{ users: PlatformUser[] }>("/platform/users"),
    ])
      .then(([b, u]) => {
        setBands(b.bands)
        setUsers(u.users)
      })
      .catch((err: Error) => setError(err.message))
  }, [user])

  if (!ready) return null
  if (!user) return <Navigate to="/login" state={{ next: "/platform" }} replace />
  if (user.platformRole !== "platform_admin") {
    return (
      <div className="px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold">Platform only</h1>
        <p className="mt-2 text-sm text-muted">This desk is for platform admins.</p>
      </div>
    )
  }

  async function toggle(band: PlatformBand, code: ModuleCode, on: boolean) {
    if (on) {
      await api(`/platform/bands/${band.id}/entitlements`, {
        method: "POST",
        body: JSON.stringify({ moduleCode: code, source: "manual" }),
      })
    } else {
      await api(`/platform/bands/${band.id}/entitlements/${code}`, {
        method: "DELETE",
      })
    }
    const data = await api<{ bands: PlatformBand[] }>("/platform/bands")
    setBands(data.bands)
  }

  async function resetPassword(userId: string) {
    const data = await api<{ temporaryPassword: string }>(
      `/platform/users/${userId}/password`,
      { method: "POST", body: JSON.stringify({}) },
    )
    setTemp((prev) => ({ ...prev, [userId]: data.temporaryPassword }))
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-10">
      <header>
        <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-gold">
          Platform
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold">Bands and plans</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Manual entitlements only. No card billing. Turning a module on does
          not go live until that package is in the deploy.
        </p>
      </header>
      {error && <p className="text-sm text-danger">{error}</p>}
      {bands.map((band) => (
        <Card key={band.id} className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold">{band.name}</h2>
              <p className="text-xs text-faint">/{band.slug}</p>
            </div>
            <Button to={`/${band.slug}`} variant="secondary">
              Open band
            </Button>
          </div>
          <ul className="mt-5 space-y-2">
            {MODULE_CODES.map((code) => {
              const entitled = band.entitlements.includes(code)
              const live = band.liveModules.includes(code)
              return (
                <li
                  key={code}
                  className="flex min-h-12 flex-wrap items-center justify-between gap-3 rounded-2xl border border-line px-3 py-2"
                >
                  <span className="font-semibold">{MODULE_TITLES[code]}</span>
                  <span className="flex items-center gap-2">
                    {live ? (
                      <Chip tone="live">Live</Chip>
                    ) : entitled ? (
                      <Chip tone="warn">Coming online</Chip>
                    ) : (
                      <Chip>Off</Chip>
                    )}
                    <Button
                      variant={entitled ? "secondary" : "primary"}
                      onClick={() => void toggle(band, code, !entitled)}
                    >
                      {entitled ? "Revoke" : "Activate"}
                    </Button>
                  </span>
                </li>
              )
            })}
          </ul>
        </Card>
      ))}

      <section>
        <h2 className="font-display text-xl font-bold">Users</h2>
        <p className="mt-1 text-sm text-muted">
          Set a temporary password. They should change it after sign-in.
        </p>
        <ul className="mt-4 space-y-2">
          {users.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-panel px-4 py-3"
            >
              <div>
                <p className="font-semibold">{row.email}</p>
                <p className="text-xs text-faint">{row.platform_role}</p>
                {temp[row.id] && (
                  <p className="mt-1 text-xs text-gold">
                    Temporary password: {temp[row.id]}
                  </p>
                )}
              </div>
              <Button variant="secondary" onClick={() => void resetPassword(row.id)}>
                Reset password
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

export function RequirePassword({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth()
  if (!ready) return null
  if (!user) return <Navigate to="/login" replace />
  return children
}
