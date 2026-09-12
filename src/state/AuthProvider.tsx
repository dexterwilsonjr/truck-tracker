import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import type { ReactNode } from "react"

import { isLiveApi } from "@/lib/live-api"
import { AuthContext } from "./auth-context"
import type { AuthContextValue } from "./auth-context"
import { api } from "@/services/api"
import type { SessionUser } from "@/types/platform"

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [ready, setReady] = useState(!isLiveApi())

  const refresh = useCallback(async () => {
    if (!isLiveApi()) {
      setUser(null)
      setReady(true)
      return
    }
    const data = await api<{ user: SessionUser | null }>("/auth/me")
    setUser(data.user)
    setReady(true)
  }, [])

  useEffect(() => {
    void Promise.resolve().then(refresh).catch(() => setReady(true))
  }, [refresh])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      refresh,
      async login(email, password) {
        const data = await api<{ user: SessionUser }>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        })
        setUser(data.user)
      },
      async register(input) {
        const data = await api<{ user: SessionUser }>("/auth/register", {
          method: "POST",
          body: JSON.stringify(input),
        })
        setUser(data.user)
      },
      async logout() {
        await api("/auth/logout", { method: "POST" })
        setUser(null)
      },
      async forgot(email) {
        await api("/auth/forgot", {
          method: "POST",
          body: JSON.stringify({ email }),
        })
      },
      async reset(token, password) {
        const data = await api<{ user: SessionUser }>("/auth/reset", {
          method: "POST",
          body: JSON.stringify({ token, password }),
        })
        setUser(data.user)
      },
    }),
    [user, ready, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
