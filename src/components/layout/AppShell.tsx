import { Link, NavLink, Outlet } from "react-router-dom"

import { brand } from "@/config/brand"
import { Icon } from "@/components/ui/Icon"
import type { IconName } from "@/components/ui/Icon"
import { LogoMark } from "@/state/DemoProvider"
import { BrandAtmosphere } from "@/components/brand/BrandVisuals"
import { useDemo } from "@/state/demo-context"
import { demoHref, useDemoBase, useDemoHref } from "@/lib/demo-paths"

const TAB_PATHS: { path: string; end?: boolean; label: string; icon: IconName }[] = [
  { path: "/", end: true, label: "Tracker", icon: "map-pin" },
  { path: "/updates", label: "Updates", icon: "megaphone" },
  { path: "/photos", label: "Photos", icon: "camera" },
  { path: "/guide", label: "Guide", icon: "compass" },
]

export function AppShell() {
  const adminTo = useDemoHref("/admin")
  const accountTo = useDemoHref("/account")
  return (
    <div className="relative z-10 flex min-h-dvh flex-col">
      <BrandAtmosphere />
      <BrandBar accountTo={accountTo} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-52 pt-5 sm:px-6 md:pt-8">
        <Outlet />
        <footer className="mt-20 flex flex-wrap items-center justify-center gap-x-2 pb-4 text-center text-xs text-muted">
          <span>
            {brand.footerLine ??
              `${brand.productName} · ${brand.bandName} — assistive location when tracking is live. Marshals over the map.`}
          </span>
          <Link
            to="/privacy"
            className="-my-2 inline-flex h-11 items-center rounded-full px-2.5 underline decoration-dotted underline-offset-4 hover:bg-white/[0.04] hover:text-muted"
          >
            Privacy
          </Link>
          <Link
            to={adminTo}
            className="-my-2 inline-flex h-11 items-center rounded-full px-2.5 underline decoration-dotted underline-offset-4 hover:bg-white/[0.04] hover:text-muted"
          >
            Demo admin
          </Link>
        </footer>
      </main>
      <BottomNav />
    </div>
  )
}

function BrandBar({ accountTo }: { accountTo: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-night/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <LogoMark size={brand.logoWide ? 42 : 38} />
          {brand.logoWide ? (
            <p className="min-w-0 truncate font-display text-[12px] font-semibold uppercase tracking-[0.14em] text-gold">
              {brand.eventLabel}
            </p>
          ) : (
            <div className="min-w-0 leading-tight">
              <p className="truncate font-display text-[15px] font-bold tracking-tight">
                {brand.productName}
              </p>
              <p className="truncate text-xs text-gold">
                {brand.bandName} · {brand.eventYear}
              </p>
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            to={accountTo}
            className="inline-flex h-11 items-center rounded-full px-3 text-[12px] font-semibold text-muted hover:bg-white/[0.06]"
          >
            Account
          </Link>
          <span className="rounded-full border border-line bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            Live demo
          </span>
        </div>
      </div>
    </header>
  )
}

function BottomNav() {
  const { snapshot } = useDemo()
  const unread = snapshot.announcements.length - snapshot.readIds.length
  const base = useDemoBase()

  return (
    <nav
      aria-label="Main navigation"
      className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]"
    >
      <div className="mx-auto grid w-full max-w-xl grid-cols-4 gap-1 rounded-[22px] border border-line bg-panel/95 p-1.5 shadow-card backdrop-blur-lg">
        {TAB_PATHS.map((tab) => (
          <NavLink
            key={tab.path}
            to={demoHref(base, tab.path)}
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
                <span className="relative">
                  <Icon
                    name={tab.icon}
                    className="size-[22px]"
                    strokeWidth={isActive ? 2.1 : 1.8}
                  />
                  {tab.label === "Updates" && unread > 0 && (
                    <span
                      aria-label={`${unread} unread updates`}
                      className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[10px] font-bold leading-none text-goldink"
                    >
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </span>
                {tab.label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
