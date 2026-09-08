import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import type { ReactNode } from "react"

import { isLiveApi } from "@/lib/live-api"
import { api } from "@/services/api"
import type { SessionUser } from "@/types/platform"

interface AuthContextValue {
  user: SessionUser | null
  ready: boolean
  refresh: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  register: (input: { email: string; password: string; name: string }) => Promise<void>
  logout: () => Promise<void>
  forgot: (email: string) => Promise<void>
  reset: (token: string, password: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

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
    void refresh().catch(() => setReady(true))
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

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
  return ctx
}

export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext)
}
