import { sql } from "../db.ts"
import type { ModuleCode } from "../modules/codes.ts"
import { packageDeployed } from "../modules/deployed.ts"

export async function entitledModules(bandId: string): Promise<ModuleCode[]> {
  const rows = await sql<{ module_code: string }[]>`
    SELECT module_code
    FROM band_entitlements
    WHERE band_id = ${bandId}::uuid
      AND status = 'active'
      AND starts_at <= now()
      AND (ends_at IS NULL OR ends_at > now())
  `
  return rows.map((row) => row.module_code as ModuleCode)
}

export function liveModules(entitled: ModuleCode[]): ModuleCode[] {
  return entitled.filter((code) => packageDeployed(code))
}

export function comingOnline(entitled: ModuleCode[]): ModuleCode[] {
  return entitled.filter((code) => !packageDeployed(code))
}

export async function isEntitled(
  bandId: string,
  code: ModuleCode,
): Promise<boolean> {
  const entitled = await entitledModules(bandId)
  return entitled.includes(code)
}

export async function isLive(
  bandId: string,
  code: ModuleCode,
): Promise<boolean> {
  return (await isEntitled(bandId, code)) && packageDeployed(code)
}
