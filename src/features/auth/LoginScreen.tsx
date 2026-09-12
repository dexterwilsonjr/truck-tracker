import { useState } from "react"
import { Link, Navigate, useLocation } from "react-router-dom"

import { isLiveApi } from "@/lib/live-api"
import { useAuth } from "@/state/auth-context"
import { AuthChrome, TobagoIdComingSoon } from "@/features/auth/AuthChrome"
import { Button } from "@/components/ui/Button"
import { TextField } from "@/components/ui/Field"
import { ApiError } from "@/services/api"

export function LoginScreen() {
  const { user, login } = useAuth()
  const location = useLocation()
  const requested = (location.state as { next?: string } | null)?.next
  const next = user?.mustResetPassword ? "/change-password" : requested?.startsWith("/") && !requested.startsWith("//") ? requested : user?.platformRole === "platform_admin" ? "/platform" : user?.bandRoles[0] ? `/${user.bandRoles[0].slug}/admin` : "/"
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={next} replace />

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!isLiveApi()) {
      setError("This sign-in is for the live app. You’re on the sales demo.")
      return
    }
    setBusy(true)
    try {
      await login(email, password)

    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthChrome title="Sign in">
      <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
        {error && (
          <p className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button type="submit" fullWidth size="lg" busy={busy}>
          Sign in
        </Button>
        <TobagoIdComingSoon />
        <div className="flex flex-col items-center gap-2 text-sm">
          <Link to="/forgot" className="text-gold underline decoration-dotted underline-offset-4">
            Forgot password
          </Link>
          <Link to="/register" className="text-muted">
            Create an account
          </Link>
        </div>
      </form>
    </AuthChrome>
  )
}
