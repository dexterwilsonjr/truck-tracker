import { Navigate, useLocation } from "react-router-dom"
import type { ReactNode } from "react"

import { useAuth } from "@/state/auth-context"
import { useBand } from "@/state/band-context"
import { bandHref } from "@/lib/paths"

export function RequireOrganizer({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth()
  const { band } = useBand()
  const location = useLocation()

  if (!ready) return null
  if (!user) {
    return <Navigate to="/login" state={{ next: location.pathname }} replace />
  }
  const allowed =
    user.platformRole === "platform_admin" ||
    user.bandRoles.some(
      (m) => m.bandId === band.id && (m.role === "organizer" || m.role === "marshal"),
    )
  if (!allowed) {
    return <Navigate to={bandHref(band.slug, "/")} replace />
  }
  return children
}
