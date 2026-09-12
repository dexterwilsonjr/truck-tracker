import type { ModuleCode } from "./codes.ts"

/**
 * Packages present in this build.
 *
 * Entitlement is the runtime switch. A band that is entitled to a code listed
 * here can use it; a band entitled to a code that is not listed still sees it as
 * "Coming online" rather than live.
 */
export const DEPLOYED_PACKAGES = new Set<ModuleCode>(["truck_tracker", "friends", "updates", "guide"])

/**
 * Packages that come with a band rather than being sold to it.
 *
 * These are the ones `seed` and `apply-brand` grant automatically, because a
 * band cannot exist without them. Everything else in `DEPLOYED_PACKAGES` is a
 * sellable SKU: the code ships, but a band only gets it when someone grants the
 * entitlement deliberately. `friends` is included in the build and sold as an
 * upsell, so it is deliberately absent here.
 */
export const INCLUDED_PACKAGES = new Set<ModuleCode>(["truck_tracker", "updates", "guide"])

export function packageDeployed(code: ModuleCode): boolean {
  return DEPLOYED_PACKAGES.has(code)
}
