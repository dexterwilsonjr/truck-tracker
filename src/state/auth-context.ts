import { createContext, useContext } from "react"
import type { SessionUser } from "@/types/platform"
export interface AuthContextValue {
  user: SessionUser | null
  ready: boolean
  refresh: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  register: (input: { email: string; password: string; name: string }) => Promise<void>
  logout: () => Promise<void>
  forgot: (email: string) => Promise<void>
  reset: (token: string, password: string) => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
  return ctx
}

export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext)
}
