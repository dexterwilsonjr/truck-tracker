import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"

import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import { Modal } from "@/components/ui/Modal"
import { Card, Chip, SectionLabel } from "@/components/ui/Primitives"
import { EmptyState } from "@/components/ui/EmptyState"
import { api, ApiError } from "@/services/api"
import { qrDataUrl } from "@/lib/qr"
import { useAuth } from "@/state/auth-context"
import { useBand } from "@/state/band-context"
import { FriendMapPanel } from "./FriendMapPanel"
import type { FriendEntry, FriendPin, FriendsView } from "./live-types"

/** How often a browser sends its fix while it is on screen and sharing. */
const BROWSER_POST_MS = 8000

function currentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location is not available in this browser."))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, () => reject(new Error("Location was unavailable. Allow Precise Location and keep this page open.")), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
  })
}

/** How a friend's last report should be described. Never overstate freshness. */
function freshnessLabel(friend: FriendEntry): string {
  const age = friend.ageSeconds
  const ago = age === null ? "" : age < 60 ? `${age}s ago` : `${Math.floor(age / 60)}m ago`
  // A browser fix carries no motion, so it is described only by its recency.
  if (friend.freshness === "live") {
    return friend.position?.source === "browser" ? `Live · updated ${ago}` : `Moving · updated ${ago}`
  }
  if (friend.freshness === "stationary") return `Stationary · last reported ${ago}`
  if (friend.freshness === "stale") return `Not recent · last reported ${ago}`
  // Sharing is on, but the last fix is too old to show. That covers both a
  // friend who just started and one whose browser stopped reporting, so say
  // only what is true of both.
  return friend.sharing ? "Sharing · no recent update" : "Not sharing right now"
}

/** A chip label that matches the same honesty as the sentence above. */
function freshnessChip(friend: FriendEntry): string {
  if (friend.freshness === "live") return friend.position?.source === "browser" ? "Live" : "Moving"
  if (friend.freshness === "stationary") return "Stationary"
  if (friend.freshness === "stale") return "Not recent"
  return friend.sharing ? "No update" : "Not sharing"
}

function toneFor(friend: FriendEntry): "live" | "teal" | "sky" | "warn" | "danger" {
  if (friend.status === "blocked") return "danger"
  if (friend.freshness === "live") return "live"
  if (friend.freshness === "stationary") return "sky"
  if (friend.freshness === "stale") return "warn"
  return "teal"
}

function pinsFrom(friends: FriendEntry[]): FriendPin[] {
  return friends
    .filter((friend) => friend.status === "accepted" && friend.position && friend.freshness)
    .map((friend) => ({
      userId: friend.userId,
      name: friend.name,
      freshness: friend.freshness!,
      ageSeconds: friend.ageSeconds ?? 0,
      position: friend.position!,
    }))
}

export function FriendsScreen() {
  const { band } = useBand()
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const [view, setView] = useState<FriendsView | null>(null)
  const [error, setError] = useState("")
  const [actionError, setActionError] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [inviteUrl, setInviteUrl] = useState("")
  const [showQr, setShowQr] = useState(false)
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null)
  const [confirming, setConfirming] = useState<FriendEntry | null>(null)
  const [retry, setRetry] = useState(0)
  const [sentAt, setSentAt] = useState("")
  const [paused, setPaused] = useState(() => typeof document !== "undefined" && document.hidden)
  const wake = useRef<WakeLockSentinel | null>(null)

  const inviteToken = params.get("invite")
  const sessionId = view?.sharing.sessionId ?? null
  const sharingActive = view?.sharing.active ?? false

  /**
   * While sharing is on and the page is visible, send this phone's position.
   *
   * The browser is the GPS until the native app ships, so this is deliberately
   * the same contract the SDK will use — only the credential differs. It pauses
   * the moment the page hides, because a hidden tab cannot report and a pin that
   * quietly stops moving is worse than an honest gap. The server trusts a
   * browser fix for well under two minutes, so the pin clears itself.
   */
  useEffect(() => {
    if (!sharingActive || !sessionId || !user) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    async function send() {
      if (stopped || document.hidden) return
      try {
        const position = await currentPosition()
        if (stopped || document.hidden) return
        await api(`/friends/bands/${band.slug}/positions`, {
          method: "POST",
          body: JSON.stringify({
            sessionId,
            points: [{
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy,
              heading: position.coords.heading,
              capturedAt: new Date(position.timestamp).toISOString(),
            }],
          }),
        })
        if (!stopped) {
          setSentAt(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" }))
          setActionError("")
        }
      } catch (err) {
        if (stopped) return
        // A refused write means the session is gone, so stop rather than retry.
        if (err instanceof ApiError && [401, 403, 409].includes(err.status)) {
          setActionError(err.message)
          setRetry((value) => value + 1)
          return
        }
        setActionError("Could not send your location. Enable Precise Location and stay on this page.")
      }
      if (!stopped && !document.hidden) timer = setTimeout(() => void send(), BROWSER_POST_MS)
    }
    async function acquireWake() {
      try {
        if ("wakeLock" in navigator) wake.current = await navigator.wakeLock.request("screen")
      } catch { /* Sharing still works with the screen kept on by hand. */ }
    }
    function visibility() {
      if (document.hidden) {
        // Stop posting. The server's short window for browser fixes then hides
        // the pin, rather than leaving friends looking at a frozen position.
        clearTimeout(timer)
        setPaused(true)
      } else {
        setPaused(false)
        if (!stopped) void send()
      }
    }
    document.addEventListener("visibilitychange", visibility)
    void acquireWake()
    void send()
    return () => {
      stopped = true
      clearTimeout(timer)
      document.removeEventListener("visibilitychange", visibility)
      void wake.current?.release()
      wake.current = null
    }
  }, [sharingActive, sessionId, band.slug, user])

  useEffect(() => {
    if (!user) return
    let stopped = false, failures = 0, generation = 0
    let timer: ReturnType<typeof setTimeout>
    let controller: AbortController | null = null
    async function poll() {
      if (stopped || document.hidden) return
      const requestGeneration = ++generation
      controller = new AbortController()
      try {
        const data = await api<FriendsView>(`/friends/bands/${band.slug}`, { signal: controller.signal })
        if (stopped || document.hidden || requestGeneration !== generation) return
        setView(data); setError(""); failures = 0
      } catch (err) {
        if (stopped || document.hidden || requestGeneration !== generation) return
        if (err instanceof ApiError && err.status === 404) { setError("That band is not available."); return }
        setError("Could not reach the friend map. Check your connection and try again.")
        failures++
      }
      if (!stopped && !document.hidden) timer = setTimeout(() => void poll(), Math.min(30000, 5000 * 2 ** failures))
    }
    function visibility() {
      generation++; clearTimeout(timer); controller?.abort()
      if (!document.hidden) void poll()
    }
    document.addEventListener("visibilitychange", visibility)
    window.addEventListener("online", visibility)
    void poll()
    return () => {
      stopped = true
      clearTimeout(timer)
      controller?.abort()
      document.removeEventListener("visibilitychange", visibility)
      window.removeEventListener("online", visibility)
    }
  }, [band.slug, retry, user])

  /**
   * Apply a change immediately, then confirm it with the server, and put the
   * list back the way it was if the server refuses.
   */
  async function mutate(key: string, optimistic: (current: FriendsView) => FriendsView, run: () => Promise<unknown>, failure: string) {
    const previous = view
    if (view) setView(optimistic(view))
    setBusy(key)
    setActionError("")
    try {
      await run()
      setRetry((value) => value + 1)
    } catch (err) {
      if (previous) setView(previous)
      setActionError(err instanceof ApiError ? err.message : failure)
    } finally {
      setBusy(null)
    }
  }

  function toggleSharing() {
    if (!view) return
    const starting = !view.sharing.active
    return mutate(
      "sharing",
      (current) => ({ ...current, sharing: { ...current.sharing, active: starting, sessionId: starting ? current.sharing.sessionId : null, endsAt: starting ? current.sharing.endsAt : null } }),
      () => api(`/friends/bands/${band.slug}/sharing`, { method: starting ? "POST" : "DELETE" }),
      starting ? "Could not start sharing." : "Could not stop sharing.",
    )
  }

  function createInvite() {
    return mutate(
      "invite",
      (current) => current,
      async () => {
        const data = await api<{ invite: { url: string } }>(`/friends/bands/${band.slug}/invites`, { method: "POST" })
        setInviteUrl(data.invite.url)
      },
      "Could not create an invite link.",
    )
  }

  function setFriendStatus(friend: FriendEntry, status: "blocked" | "removed") {
    return mutate(
      `friend:${friend.connectionId}`,
      (current) => ({
        ...current,
        friends: status === "removed"
          ? current.friends.filter((entry) => entry.connectionId !== friend.connectionId)
          : current.friends.map((entry) => entry.connectionId === friend.connectionId
              ? { ...entry, status: "blocked", blockedByMe: true, position: null, sharing: false, freshness: null }
              : entry),
      }),
      () => status === "blocked"
        ? api(`/friends/bands/${band.slug}/connections/${friend.connectionId}/block`, { method: "POST" })
        : api(`/friends/bands/${band.slug}/connections/${friend.connectionId}`, { method: "DELETE" }),
      status === "blocked" ? "Could not block that person." : "Could not remove that friend.",
    )
  }

  function revokeDevice(deviceId: string) {
    return mutate(
      `device:${deviceId}`,
      (current) => ({ ...current, devices: current.devices.filter((entry) => entry.id !== deviceId) }),
      () => api(`/friends/bands/${band.slug}/devices/${deviceId}`, { method: "DELETE" }),
      "Could not remove that device.",
    )
  }

  async function acceptInvite() {
    setBusy("accept"); setActionError("")
    try {
      await api(`/friends/invites/${inviteToken}/accept`, { method: "POST" })
      const next = new URLSearchParams(params); next.delete("invite"); setParams(next, { replace: true })
      setRetry((value) => value + 1)
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not accept that invite.")
    } finally {
      setBusy(null)
    }
  }

  async function shareInvite() {
    if (!inviteUrl) return
    try {
      if (navigator.share) { await navigator.share({ title: `Find me on ${band.name}`, url: inviteUrl }); return }
      await navigator.clipboard.writeText(inviteUrl)
      setActionError("")
    } catch { /* A cancelled share is not an error worth reporting. */ }
  }

  function locate() {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (position) => setMe({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => setActionError("Location was unavailable. Allow location in your browser settings."),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  }

  if (!user) {
    return (
      <div className="space-y-5">
        <Header bandName={band.name} />
        <EmptyState
          icon="users"
          title="Sign in to find your friends"
          body="Friend sharing uses your account so only the people you invite can see you. Nobody is visible until they choose to share."
          action={<Button to="/login" state={{ next: `/${band.slug}/friends${inviteToken ? `?invite=${inviteToken}` : ""}` }}>Sign in</Button>}
        />
      </div>
    )
  }

  const friends = view?.friends ?? []
  const accepted = friends.filter((friend) => friend.status === "accepted")
  const blocked = friends.filter((friend) => friend.status === "blocked")
  const sharing = view?.sharing.active ?? false
  const pins = pinsFrom(friends)

  return (
    <div className="space-y-5">
      <Header bandName={band.name} />

      {error && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-warn/30 p-4">
          <p role="alert" className="max-w-2xl text-sm leading-relaxed">{error}</p>
          <Button variant="secondary" onClick={() => setRetry((value) => value + 1)}>Try again</Button>
        </Card>
      )}
      {actionError && <p role="alert" className="rounded-2xl border border-warn/30 bg-panel p-4 text-sm leading-relaxed">{actionError}</p>}

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <SectionLabel>Your location</SectionLabel>
            <p className="mt-2 flex items-center gap-2 text-base font-semibold">
              <span aria-hidden="true" className={`size-2 rounded-full ${sharing ? "bg-live" : "bg-faint"}`} />
              {sharing ? "Sharing with your friends" : "Not sharing"}
            </p>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
              {sharing
                ? `Only people you are connected to can see you. Sharing stops on its own${view?.sharing.endsAt ? ` at ${new Date(view.sharing.endsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}, or the moment you stop it.`
                : "You are invisible on the map until you start sharing. Accepting an invite does not turn sharing on."}
            </p>
            {sharing && (
              <p className="mt-3 max-w-xl rounded-2xl border border-warn/25 bg-warn/[0.06] p-3 text-xs leading-relaxed">
                <strong className="font-semibold">Keep this page open.</strong> Until the phone app is ready, your location comes from this browser, so sharing pauses when you switch apps or lock the screen. Your friends stop seeing you until you come back.
              </p>
            )}
            {sharing && (
              <p aria-live="polite" className="mt-2 text-xs text-muted">
                {paused ? "Paused — the page is in the background." : sentAt ? `Last sent at ${sentAt}.` : "Waiting for the first fix…"}
              </p>
            )}
          </div>
          <Button
            size="lg"
            variant={sharing ? "secondary" : "primary"}
            busy={busy === "sharing"}
            onClick={() => void toggleSharing()}
            icon={<Icon name={sharing ? "lock" : "gps"} className="size-5" />}
          >
            {sharing ? "Stop sharing" : "Start sharing"}
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <SectionLabel>Invite someone you came with</SectionLabel>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
          An invite is a private link. Whoever opens it can see you while you are sharing, and you can see them. You can stop or block at any time.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="soft" busy={busy === "invite"} onClick={() => void createInvite()} icon={<Icon name="plus" className="size-5" />}>Create an invite link</Button>
          {inviteUrl && (
            <>
              <Button variant="secondary" onClick={() => setShowQr(true)} icon={<Icon name="image" className="size-5" />}>Show QR code</Button>
              <Button variant="secondary" onClick={() => void shareInvite()} icon={<Icon name="message" className="size-5" />}>Share the link</Button>
              <Button variant="ghost" onClick={() => { void navigator.clipboard.writeText(inviteUrl) }}>Copy link</Button>
            </>
          )}
          <Button variant="ghost" onClick={locate} icon={<Icon name="map-pin" className="size-5" />}>Show me on the map</Button>
        </div>
        {inviteUrl && <p className="mt-3 break-all rounded-2xl border border-line bg-raised/40 p-3 text-xs leading-relaxed text-muted">{inviteUrl}</p>}
        {(view?.invites.length ?? 0) > 0 && (
          <p className="mt-3 text-xs text-muted">
            {view!.invites.length} open {view!.invites.length === 1 ? "invite" : "invites"} that nobody has used yet.
          </p>
        )}
      </Card>

      {pins.length > 0 && <FriendMapPanel pins={pins} me={me} />}

      <section className="space-y-3" aria-label="Your friends">
        <SectionLabel>Your friends</SectionLabel>
        {accepted.length === 0 && !view && (
          <div className="grid min-h-[160px] place-items-center rounded-card border border-line bg-panel text-sm text-muted" role="status">Loading your friends…</div>
        )}
        {accepted.length === 0 && view && (
          <EmptyState
            icon="users"
            title="Just you so far"
            body="Create an invite link and send it to the people you came with. They will appear here once they open it."
          />
        )}
        <ul className="space-y-3">
          {accepted.map((friend) => (
            <li key={friend.connectionId}>
              <Card className="flex flex-wrap items-center gap-4 p-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-teal/20 bg-teal/10 text-teal">
                  <Icon name="users" className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold">{friend.name || "Friend"}</p>
                  <p className="mt-1 text-xs text-muted">{freshnessLabel(friend)}</p>
                </div>
                <Chip tone={toneFor(friend)}>{freshnessChip(friend)}</Chip>
                <div className="flex gap-2">
                  <Button variant="ghost" busy={busy === `friend:${friend.connectionId}`} onClick={() => void setFriendStatus(friend, "removed")}>Remove</Button>
                  <Button variant="danger" disabled={busy === `friend:${friend.connectionId}`} onClick={() => setConfirming(friend)}>Block</Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
        {blocked.length > 0 && (
          <div className="space-y-2">
            <SectionLabel>Blocked</SectionLabel>
            <p className="text-xs leading-relaxed text-muted">
              Blocked people cannot see you and cannot reach you again with a new invite. This stays in place for now; ask support if you need it lifted.
            </p>
            <ul className="space-y-2">
              {blocked.map((friend) => (
                <li key={friend.connectionId} className="rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-muted">
                  {friend.name || "Friend"}{friend.blockedByMe ? " · blocked by you" : " · they blocked you"}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {(view?.devices.length ?? 0) > 0 && (
        <Card className="p-5">
          <SectionLabel>Signed-in phones</SectionLabel>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
            A phone can only share your location while it is signed in and enrolled. Removing one stops it immediately — the one you are holding will need to enrol again.
          </p>
          <ul className="mt-4 space-y-2">
            {view!.devices.map((device) => (              <li key={device.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-raised/30 px-4 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-line text-muted">
                  <Icon name="gps" className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{device.platform === "ios" ? "iPhone" : "Android phone"}{device.appVersion ? ` · ${device.appVersion}` : ""}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {device.lastSeenAt ? `Last used ${new Date(device.lastSeenAt).toLocaleDateString()}` : "Not used yet"}
                    {" · "}Enrolled until {new Date(device.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <Button variant="ghost" busy={busy === `device:${device.id}`} onClick={() => void revokeDevice(device.id)}>Remove</Button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            {view!.devices.length} of {view!.maxDevices} allowed for this event. Signing out removes every phone.
          </p>
        </Card>
      )}

      <p className="flex items-center justify-center gap-1.5 px-1 text-center text-xs text-muted">
        <Icon name="lock" className="size-3.5" />
        Private positions are never shown on the public truck map.
      </p>

      <Modal open={showQr && Boolean(inviteUrl)} onClose={() => setShowQr(false)} title="Scan to join">
        <p className="text-sm leading-relaxed text-muted">
          Have your friend point their camera at this. The link is private and works once, so show it in person rather than posting it.
        </p>
        {/* QR reading needs dark modules on a light surface, so this sits on white. */}
        <div className="mt-4 grid place-items-center rounded-2xl bg-white p-4">
          <img src={qrDataUrl(inviteUrl)} alt="QR code for the friend invite link" className="h-auto w-full max-w-[260px]" />
        </div>
        <p className="mt-3 break-all rounded-2xl border border-line bg-raised/40 p-3 text-xs leading-relaxed text-muted">{inviteUrl}</p>
        <div className="mt-5 flex gap-3">
          <Button variant="secondary" fullWidth onClick={() => { void navigator.clipboard.writeText(inviteUrl) }}>Copy link</Button>
          <Button fullWidth onClick={() => setShowQr(false)}>Done</Button>
        </div>
      </Modal>

      <Modal open={Boolean(confirming)} onClose={() => setConfirming(null)} title="Block this person?">
        <p className="text-sm leading-relaxed">
          {confirming?.name || "This person"} will stop appearing for you, and they will not be able to see you or invite you again.
        </p>
        <div className="mt-5 flex gap-3">
          <Button variant="danger" fullWidth busy={busy === `friend:${confirming?.connectionId}`} onClick={() => { const target = confirming; setConfirming(null); if (target) void setFriendStatus(target, "blocked") }}>Block them</Button>
          <Button variant="secondary" fullWidth onClick={() => setConfirming(null)}>Keep as friend</Button>
        </div>
      </Modal>

      <Modal open={Boolean(inviteToken)} onClose={() => { const next = new URLSearchParams(params); next.delete("invite"); setParams(next, { replace: true }) }} title="Friend invite">
        <p className="text-sm leading-relaxed">
          Someone in {band.name} wants to share locations with you. If you accept, you will be able to see each other while either of you is sharing, and you can stop or block at any time.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">Your location stays private until you press Start sharing.</p>
        {actionError && <p role="alert" className="mt-3 rounded-2xl border border-warn/30 p-3 text-sm">{actionError}</p>}
        <div className="mt-5 flex gap-3">
          <Button fullWidth busy={busy === "accept"} onClick={() => void acceptInvite()}>Accept invite</Button>
          <Button variant="secondary" fullWidth onClick={() => { const next = new URLSearchParams(params); next.delete("invite"); setParams(next, { replace: true }) }}>Not now</Button>
        </div>
      </Modal>
    </div>
  )
}

function Header({ bandName }: { bandName: string }) {
  return (
    <header className="px-1">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">{bandName}</p>
      <h1 className="mt-2 font-display text-[30px] font-bold leading-tight tracking-tight sm:text-4xl">Find your friends</h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
        Share where you are with the people you came with. It lasts for this event, and you are always the one who decides.
      </p>
    </header>
  )
}
