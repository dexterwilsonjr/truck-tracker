import { Link, useNavigate } from "react-router-dom"

import { useAuth } from "@/state/AuthProvider"
import { useOptionalBand } from "@/state/BandProvider"
import { bandHref } from "@/lib/paths"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Primitives"

export function AccountScreen() {
  const { user, logout } = useAuth()
  const band = useOptionalBand()
  const navigate = useNavigate()
  const home = bandHref(band?.band.slug, "/")

  if (!user) {
    return (
      <div className="space-y-6 motion-safe:animate-fade-up">
        <h1 className="font-display text-[30px] font-bold tracking-tight">Account</h1>
        <p className="text-[15px] text-muted">
          Sign in to keep a Library, print requests, and face match when this
          band turns those on. You can still find the truck without an account.
        </p>
        <Button size="lg" to="/login">
          Sign in
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 motion-safe:animate-fade-up">
      <header>
        <h1 className="font-display text-[30px] font-bold tracking-tight">Account</h1>
        <p className="mt-2 text-[15px] text-muted">
          {user.name || user.email}
        </p>
      </header>
      <Card className="p-5">
        <p className="text-sm text-muted">{user.email}</p>
        {user.mustResetPassword && (
          <p className="mt-3 text-sm text-warn">
            An admin set a temporary password. Change it from Forgot password
            after you sign out, or keep using this one until you do.
          </p>
        )}
        {user.platformRole === "platform_admin" && (
          <Button to="/platform" variant="secondary" className="mt-4">
            Platform admin
          </Button>
        )}
        <Link
          to="/privacy"
          className="mt-4 inline-flex h-11 items-center text-sm text-gold underline decoration-dotted underline-offset-4"
        >
          Privacy
        </Link>
      </Card>
      <Button
        size="lg"
        fullWidth
        variant="danger"
        onClick={() => {
          void logout().then(() => navigate(home))
        }}
      >
        Log out
      </Button>
    </div>
  )
}
