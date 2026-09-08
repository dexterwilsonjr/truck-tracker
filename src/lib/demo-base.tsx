import { createContext, useContext } from "react"
import type { ReactNode } from "react"

const DemoBaseContext = createContext("")

export function DemoBaseProvider({
  base,
  children,
}: {
  base: string
  children: ReactNode
}) {
  return (
    <DemoBaseContext.Provider value={base}>{children}</DemoBaseContext.Provider>
  )
}

export function useDemoBase(): string {
  return useContext(DemoBaseContext)
}

/** Prefix sales-demo routes when they live under /demo (production API mode). */
export function demoHref(base: string, path: string): string {
  if (!path.startsWith("/")) return `${base}/${path}`
  if (path === "/") return base || "/"
  return `${base}${path}`
}

export function useDemoHref(path: string): string {
  return demoHref(useDemoBase(), path)
}
