import { Link } from "react-router-dom"
import type { ReactNode } from "react"

import { brand } from "@/config/brand"
import { LogoMark } from "@/state/DemoProvider"
import { Icon } from "@/components/ui/Icon"

export function AuthChrome({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-12">
      <div className="mb-8 flex flex-col items-center text-center">
        <LogoMark size={48} />
        <p className="mt-4 font-display text-lg font-bold">{brand.productName}</p>
        <p className="text-xs text-gold">{brand.tagline}</p>
        <h1 className="mt-6 font-display text-[28px] font-bold tracking-tight">
          {title}
        </h1>
      </div>
      {children}
      <p className="mt-8 text-center text-[12px] text-faint">
        <Link to="/privacy" className="underline decoration-dotted underline-offset-4">
          Privacy
        </Link>
      </p>
    </div>
  )
}

export function TobagoIdComingSoon() {
  return (
    <div className="space-y-2">
      <p className="text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">
        Or
      </p>
      <button
        type="button"
        disabled
        aria-disabled="true"
        title="Tobago ID is not available yet"
        className="inline-flex h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-full border border-line bg-white/[0.04] px-5 text-[15px] font-semibold text-faint opacity-70"
      >
        <Icon name="lock" className="size-4" />
        Tobago ID coming soon
      </button>
    </div>
  )
}
