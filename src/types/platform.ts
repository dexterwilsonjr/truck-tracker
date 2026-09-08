import type { Brand } from "@/config/brand"
import type { ModuleCode } from "@/config/modules"
import type { UpsellCopy } from "@/features/upsell/catalog"

export interface SessionUser {
  id: string
  email: string
  name: string
  platformRole: "patron" | "platform_admin"
  bandRoles: { bandId: string; slug: string; role: "organizer" | "marshal" }[]
  mustResetPassword: boolean
}

export interface BandPublic {
  id: string
  slug: string
  name: string
  eventYear: number
  eventLabel: string
  tagline: string
  brand: Partial<Brand> & Record<string, unknown>
  entitlements: ModuleCode[]
  deployedPackages: ModuleCode[]
  liveModules: ModuleCode[]
  comingOnline: ModuleCode[]
  upsells: Record<ModuleCode, UpsellCopy>
  catalog: ModuleCode[]
}

export interface ApiErrorBody {
  error?: {
    code: string
    message?: string
    module?: ModuleCode
    upsell?: UpsellCopy
  }
}
