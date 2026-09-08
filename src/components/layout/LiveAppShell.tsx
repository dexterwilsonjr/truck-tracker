import { Link, NavLink, Outlet, useParams } from "react-router-dom"

import { brand } from "@/config/brand"
import { Icon } from "@/components/ui/Icon"
import type { IconName } from "@/components/ui/Icon"
import { LogoMark } from "@/state/DemoProvider"
import { useAuth } from "@/state/AuthProvider"
import { useBand } from "@/state/BandProvider"
import { bandHref } from "@/lib/paths"

const TABS: { path: string; end?: boolean; label: string; icon: IconName }[] = [
  { path: "/", end: true, label: "Tracker", icon: "map-pin" },
  { path: "/updates", label: "Updates", icon: "megaphone" },
  { path: "/photos", label: "Photos", icon: "camera" },
  { path: "/guide", label: "Guide", icon: "compass" },
]

export function LiveAppShell() {
  const { band } = useBand()

  return (
    <div className="flex min-h-dvh flex-col">
      <BrandBar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-44 pt-5 sm:px-6 md:pt-8">
        <Outlet />
        <footer className="mt-16 flex flex-wrap items-center justify-center gap-x-3 text-center text-xs text-faint">
          <span>
            {brand.productName} · {band.name} — assistive location when tracking
            is live. Marshals over the map.
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
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <LogoMark size={38} />
          <div className="min-w-0 leading-tight">
            <p className="truncate font-display text-[15px] font-bold tracking-tight">
              {brand.productName}
            </p>
            <p className="truncate text-xs text-gold">
              {band.name} · {band.eventYear}
            </p>
          </div>
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

  return (
    <nav
      aria-label="Main navigation"
      className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]"
    >
      <div className="mx-auto grid w-full max-w-xl grid-cols-4 gap-1 rounded-[22px] border border-line bg-panel/95 p-1.5 shadow-card backdrop-blur-lg">
        {TABS.map((tab) => (
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
