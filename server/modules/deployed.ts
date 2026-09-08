import type { ModuleCode } from "./codes.ts"

/**
 * Packages present in this deploy. Empty in Platform V1.
 * Entitlement is the only runtime switch; if a band is entitled here but
 * the code is not listed, the API still returns the module as not live
 * (frontend shows “Coming online”).
 */
export const DEPLOYED_PACKAGES = new Set<ModuleCode>([])

export function packageDeployed(code: ModuleCode): boolean {
  return DEPLOYED_PACKAGES.has(code)
}
