import { sql } from "../db.ts"
import { isModuleCode, type ModuleCode } from "../modules/codes.ts"

export type BillingSource = "manual" | "custom_billing"

export interface ActivateEntitlementInput {
  bandId: string
  moduleCode: ModuleCode
  planCode?: string
  invoiceRef?: string
  startsAt?: Date
  endsAt?: Date
  source?: BillingSource
}

export interface RevokeEntitlementInput {
  bandId: string
  moduleCode: ModuleCode
  reason?: string
}

/**
 * Custom-billing adapter. V1 writes entitlements only — no Stripe.
 * A later billing system calls these two functions after an invoice is paid
 * or cancelled.
 */
export async function activateEntitlement(
  input: ActivateEntitlementInput,
): Promise<void> {
  if (!isModuleCode(input.moduleCode)) {
    throw new Error("unknown_module")
  }
  const source = input.source ?? "manual"
  await sql`
    INSERT INTO band_entitlements (
      band_id, module_code, status, source, plan_code, invoice_ref, starts_at, ends_at,
      revoked_at, revoke_reason
    )
    VALUES (
      ${input.bandId}::uuid,
      ${input.moduleCode},
      'active',
      ${source},
      ${input.planCode ?? null},
      ${input.invoiceRef ?? null},
      ${input.startsAt ?? new Date()},
      ${input.endsAt ?? null},
      NULL,
      NULL
    )
    ON CONFLICT (band_id, module_code) DO UPDATE SET
      status = 'active',
      source = EXCLUDED.source,
      plan_code = EXCLUDED.plan_code,
      invoice_ref = EXCLUDED.invoice_ref,
      starts_at = EXCLUDED.starts_at,
      ends_at = EXCLUDED.ends_at,
      revoked_at = NULL,
      revoke_reason = NULL
  `
}

export async function revokeEntitlement(
  input: RevokeEntitlementInput,
): Promise<void> {
  await sql`
    UPDATE band_entitlements
    SET
      status = 'revoked',
      revoked_at = now(),
      revoke_reason = ${input.reason ?? null}
    WHERE band_id = ${input.bandId}::uuid
      AND module_code = ${input.moduleCode}
  `
}
