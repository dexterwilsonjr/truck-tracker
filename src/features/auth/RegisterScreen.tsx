import { useState } from "react"
import { Link, Navigate, useNavigate } from "react-router-dom"

import { isLiveApi } from "@/lib/live-api"
import { useAuth } from "@/state/AuthProvider"
import { AuthChrome, TobagoIdComingSoon } from "@/features/auth/AuthChrome"
import { Button } from "@/components/ui/Button"
import { TextField } from "@/components/ui/Field"
import { ApiError } from "@/services/api"

export function RegisterScreen() {
  const { user, register } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/" replace />

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!isLiveApi()) {
      setError("Accounts need the live API. You’re on the sales demo.")
      return
    }
    setBusy(true)
    try {
      await register({ email, password, name })
      navigate("/", { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create that account.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthChrome title="Create an account">
      <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
        {error && (
          <p className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}
        <TextField
          label="Name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
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
          autoComplete="new-password"
          hint="At least 8 characters."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button type="submit" fullWidth size="lg" busy={busy}>
          Create account
        </Button>
        <TobagoIdComingSoon />
        <p className="text-center text-sm text-muted">
          Already have one?{" "}
          <Link to="/login" className="text-gold underline decoration-dotted underline-offset-4">
            Sign in
          </Link>
        </p>
      </form>
    </AuthChrome>
  )
}
