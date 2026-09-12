import { DemoBaseContext } from "./demo-paths"
import type { ReactNode } from "react"


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
