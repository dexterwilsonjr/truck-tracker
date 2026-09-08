import { useState } from "react"
import { Link } from "react-router-dom"

import { isLiveApi } from "@/lib/live-api"
import { useAuth } from "@/state/AuthProvider"
import { AuthChrome } from "@/features/auth/AuthChrome"
import { Button } from "@/components/ui/Button"
import { TextField } from "@/components/ui/Field"
import { ApiError } from "@/services/api"

export function ForgotScreen() {
  const { forgot } = useAuth()
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!isLiveApi()) {
      setError("Password reset needs the live API.")
      return
    }
    setBusy(true)
    try {
      await forgot(email)
      setSent(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send that email.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthChrome title="Forgot password">
      {sent ? (
        <div className="space-y-4 text-center">
          <p className="text-[15px] leading-relaxed text-muted">
            If that email has an account, a reset link is on the way. Check
            the inbox (and the server log in development).
          </p>
          <Button to="/login" variant="secondary" fullWidth>
            Back to sign in
          </Button>
        </div>
      ) : (
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
          <Button type="submit" fullWidth size="lg" busy={busy}>
            Send reset link
          </Button>
          <p className="text-center text-sm">
            <Link to="/login" className="text-gold underline decoration-dotted underline-offset-4">
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </AuthChrome>
  )
}
