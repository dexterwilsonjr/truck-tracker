import { useState } from "react"
import { Navigate, useNavigate, useSearchParams } from "react-router-dom"

import { isLiveApi } from "@/lib/live-api"
import { useAuth } from "@/state/auth-context"
import { AuthChrome } from "@/features/auth/AuthChrome"
import { Button } from "@/components/ui/Button"
import { TextField } from "@/components/ui/Field"
import { ApiError } from "@/services/api"

export function ResetScreen() {
  const { reset } = useAuth()
  const [params] = useSearchParams()
  const token = params.get("token") ?? ""
  const navigate = useNavigate()
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!token) return <Navigate to="/forgot" replace />

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!isLiveApi()) {
      setError("Password reset needs the live API.")
      return
    }
    setBusy(true)
    try {
      await reset(token, password)
      navigate("/", { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reset that password.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthChrome title="Set a new password">
      <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
        {error && (
          <p className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          hint="At least 12 characters."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button type="submit" fullWidth size="lg" busy={busy}>
          Save password
        </Button>
      </form>
    </AuthChrome>
  )
}
