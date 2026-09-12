import { useState } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { useAuth } from "@/state/auth-context"
import { api } from "@/services/api"
import { Button } from "@/components/ui/Button"
import { TextField } from "@/components/ui/Field"
import { AuthChrome } from "./AuthChrome"
export function ChangePasswordScreen() {
  const { user, ready, refresh, logout } = useAuth()
  const navigate = useNavigate()
  const [current, setCurrent] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  if (!ready) return <p>Loading…</p>
  if (!user) return <Navigate to="/login" replace />
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("")
    try {
      await api("/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword: current, password }) })
      await refresh(); navigate("/login", { replace: true })
    } catch (e) { setError(e instanceof Error ? e.message : "Could not change password.") } finally { setBusy(false) }
  }
  return <AuthChrome title="Change your password"><p className="mb-4">Choose a new password with at least 12 characters. Your other sessions will be signed out.</p><form onSubmit={e => void submit(e)} className="space-y-4">
    <TextField label="Current password" type="password" autoComplete="current-password" required value={current} onChange={e => setCurrent(e.target.value)} />
    <TextField label="New password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={e => setPassword(e.target.value)} />
    {error && <p role="alert" className="text-danger">{error}</p>}<Button type="submit" busy={busy} fullWidth>Save password</Button>
    <Button variant="secondary" disabled={busy} onClick={() => { setBusy(true); void logout().catch(e => setError(e.message)).finally(() => setBusy(false)) }}>Log out</Button>
  </form></AuthChrome>
}
