import { Link, NavLink, Outlet } from "react-router-dom"

import { brand } from "@/config/brand"
import { Icon } from "@/components/ui/Icon"
import type { IconName } from "@/components/ui/Icon"
import { LogoMark } from "@/state/DemoProvider"
import { useDemo } from "@/state/demo-context"

const TABS: { to: string; end?: boolean; label: string; icon: IconName }[] = [
  { to: "/", end: true, label: "Tracker", icon: "map-pin" },
  { to: "/updates", label: "Updates", icon: "megaphone" },
  { to: "/photos", label: "Photos", icon: "camera" },
  { to: "/guide", label: "Guide", icon: "compass" },
]

export function AppShell() {
  return (
    <div className="flex min-h-dvh flex-col">
      <BrandBar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-44 pt-5 sm:px-6 md:pt-8">
        <Outlet />
        <footer className="mt-16 flex flex-wrap items-center justify-center gap-x-2 text-center text-xs text-faint">
          <span>
            Truck Tracker · demo build — real maps, GPS, push notifications and
            photo uploads connect later.
          </span>
          <Link
            to="/admin"
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

function BrandBar() {
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
              {brand.bandName} · {brand.eventYear}
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-line bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
          Live demo
        </span>
      </div>
    </header>
  )
}

function BottomNav() {
  const { snapshot } = useDemo()
  const unread = snapshot.announcements.length - snapshot.readIds.length

  return (
    <nav
      aria-label="Main navigation"
      className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]"
    >
      <div className="mx-auto grid w-full max-w-xl grid-cols-4 gap-1 rounded-[22px] border border-line bg-panel/95 p-1.5 shadow-card backdrop-blur-lg">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
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
