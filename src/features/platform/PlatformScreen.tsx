import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { Navigate } from "react-router-dom"

import { MODULE_CODES } from "@/config/modules"
import type { ModuleCode } from "@/config/modules"
import { MODULE_TITLES } from "@/features/upsell/catalog"
import { useAuth } from "@/state/auth-context"
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
  const [busy, setBusy] = useState(false)
  const [bandPage, setBandPage] = useState(0)
  const [userPage, setUserPage] = useState(0)
  const [moreBands, setMoreBands] = useState(false)
  const [moreUsers, setMoreUsers] = useState(false)
  const [requests, setRequests] = useState<{ band_name: string; module_code: string; email: string }[]>([])
  const [requestPage, setRequestPage] = useState(0)
  const [moreRequests, setMoreRequests] = useState(false)
  const [bands, setBands] = useState<PlatformBand[]>([])
  const [users, setUsers] = useState<PlatformUser[]>([])
  const [error, setError] = useState<string | null>(null)
  const [temp, setTemp] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!user || user.platformRole !== "platform_admin") return
    const controller = new AbortController()
    void Promise.all([
      api<{ bands: PlatformBand[]; hasMore: boolean }>(`/platform/bands?page=${bandPage}`, { signal: controller.signal }),
      api<{ users: PlatformUser[]; hasMore: boolean }>(`/platform/users?page=${userPage}`, { signal: controller.signal }),
      api<{ requests: typeof requests; hasMore: boolean }>(`/platform/requests?page=${requestPage}`, { signal: controller.signal }),
    ])
      .then(([b, u, r]) => {
        if (controller.signal.aborted) return
        setMoreBands(b.hasMore); setMoreUsers(u.hasMore); setRequests(r.requests); setMoreRequests(r.hasMore)
        setBands(b.bands)
        setUsers(u.users)
      })
      .catch((err: Error) => { if (!controller.signal.aborted) setError(err.message) })
    return () => controller.abort()
  }, [user, bandPage, userPage, requestPage])

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

  async function run(action: () => Promise<void>) {
    setBusy(true); setError(null)
    try { await action() } catch (e) { setError(e instanceof Error ? e.message : "Could not save.") } finally { setBusy(false) }
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
    const data = await api<{ bands: PlatformBand[]; hasMore: boolean }>(`/platform/bands?page=${bandPage}`)
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
                      busy={busy}
                      onClick={() => void run(() => toggle(band, code, !entitled))}
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

      <div className="flex gap-3"><Button disabled={bandPage === 0 || busy} onClick={() => setBandPage(p => p - 1)}>Previous bands</Button><Button disabled={!moreBands || busy} onClick={() => setBandPage(p => p + 1)}>Next bands</Button></div>
      <section>
        <h2 className="font-display text-xl font-bold">Users</h2>
        <p className="mt-1 text-sm text-muted">
          Set a temporary password. They must change it after sign-in.
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
              <Button variant="secondary" busy={busy} onClick={() => void run(() => resetPassword(row.id))}>
                Reset password
              </Button>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex gap-3"><Button disabled={userPage === 0 || busy} onClick={() => setUserPage(p => p - 1)}>Previous users</Button><Button disabled={!moreUsers || busy} onClick={() => setUserPage(p => p + 1)}>Next users</Button></div>
      </section>
      <section><h2 className="font-display text-xl font-bold">Feature requests</h2><ul className="mt-4 space-y-3">{requests.map(r => <li key={`${r.band_name}:${r.module_code}`}>{r.band_name} · {r.module_code} · {r.email}</li>)}</ul><div className="mt-4 flex gap-3"><Button disabled={requestPage === 0} onClick={() => setRequestPage(p => p - 1)}>Previous requests</Button><Button disabled={!moreRequests} onClick={() => setRequestPage(p => p + 1)}>Next requests</Button></div></section>
    </div>
  )
}

export function RequirePassword({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth()
  if (!ready) return null
  if (!user) return <Navigate to="/login" replace />
  return children
}
