import { Link, NavLink, Outlet, useParams } from "react-router-dom"

import { brand } from "@/config/brand"
import type { ModuleCode } from "@/config/modules"
import { Icon } from "@/components/ui/Icon"
import type { IconName } from "@/components/ui/Icon"
import { LogoMark } from "@/state/DemoProvider"
import { BrandAtmosphere } from "@/components/brand/BrandVisuals"
import { useAuth } from "@/state/auth-context"
import { useBand } from "@/state/band-context"
import { bandHref } from "@/lib/paths"

const TABS: { path: string; end?: boolean; label: string; icon: IconName; module?: ModuleCode }[] = [
  { path: "/", end: true, label: "Tracker", icon: "map-pin" },
  { path: "/friends", label: "Friends", icon: "users", module: "friends" },
  { path: "/updates", label: "Updates", icon: "megaphone" },
  { path: "/photos", label: "Photos", icon: "camera" },
  { path: "/guide", label: "Guide", icon: "compass" },
]

export function LiveAppShell() {
  const { band } = useBand()

  return (
    <div className="relative isolate flex min-h-dvh flex-col">
      <BrandAtmosphere />
      <BrandBar />
      <a href="#main-content" className="sr-only z-[90] rounded-full bg-gold px-5 py-3 text-goldink focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>
      <main id="main-content" className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-5 sm:px-6 md:pt-8">
        <Outlet />
        <footer className="mt-10 flex flex-wrap items-center justify-center gap-x-3 border-t border-line/60 pb-4 pt-6 text-center text-xs leading-relaxed text-muted">
          <span>
            {brand.footerLine ??
              `${brand.productName} · ${band.name} — assistive location when tracking is live. Marshals over the map.`}
          </span>
          <Link
            to="/privacy"
            className="-my-2 inline-flex h-11 items-center rounded-full px-2.5 underline decoration-dotted underline-offset-4 hover:bg-white/[0.04] hover:text-muted"
          >
            Privacy
          </Link>
        </footer>
      </main>
      <BottomNav />
    </div>
  )
}

function BrandBar() {
  const { band } = useBand()
  const { user } = useAuth()
  const { bandSlug } = useParams()

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-night/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link to={bandHref(bandSlug, "/")} aria-label={`${band.name} home`} className="shrink-0 rounded-xl"><LogoMark size={brand.logoWide ? 42 : 38} /></Link>
          {brand.logoWide ? (
            <p className="min-w-0 text-[10px] font-semibold uppercase leading-relaxed tracking-[0.14em] text-gold sm:text-xs">
              <span className="block">{(band.eventLabel || brand.eventLabel).split("·")[0]?.trim()}</span>
              <span className="block text-muted">Carnival {band.eventYear}</span>
            </p>
          ) : (
            <div className="min-w-0 leading-tight">
              <p className="truncate font-display text-[15px] font-bold tracking-tight">
                {brand.productName}
              </p>
              <p className="truncate text-xs text-gold">
                {band.name} · {band.eventYear}
              </p>
            </div>
          )}
        </div>
        <Link
          to={bandHref(bandSlug, "/account")}
          className="inline-flex h-11 shrink-0 items-center rounded-full border border-line bg-white/[0.05] px-3 text-[12px] font-semibold text-muted hover:bg-white/[0.08]"
        >
          {user ? user.name || "Account" : "Sign in"}
        </Link>
      </div>
    </header>
  )
}

function BottomNav() {
  const { bandSlug } = useParams()
  const { moduleLive } = useBand()
  // A tab for a package this band has not bought would lead to an upsell, so it
  // is simply not shown. The set stays fixed in size, so the row cannot reflow.
  const tabs = TABS.filter((tab) => !tab.module || moduleLive(tab.module))

  return (
    <nav
      aria-label="Main navigation"
      className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]"
    >
      <div className={`mx-auto grid w-full max-w-xl ${tabs.length === 5 ? "grid-cols-5" : "grid-cols-4"} gap-1 rounded-[22px] border border-line bg-panel/95 p-1.5 shadow-[0_8px_40px_rgba(0,0,0,0.55)] backdrop-blur-lg`}>
        {tabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={bandHref(bandSlug, tab.path)}
            end={tab.end}
            className={({ isActive }) =>
              [
                "relative flex h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-semibold transition",
                isActive
                  ? "bg-gold/12 text-gold"
                  : "text-faint hover:bg-white/[0.04] hover:text-muted",
              ].join(" ")
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  name={tab.icon}
                  className="size-[22px]"
                  strokeWidth={isActive ? 2.1 : 1.8}
                />
                {tab.label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
