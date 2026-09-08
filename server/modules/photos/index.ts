/** Photos + Library SKU — not deployed in Platform V1. */
export const MODULE = "photos" as const
export const DEPLOYED = false

export interface LibraryObject {
  key: string
  contentType: string
  bytes: number
}

export const UPLOAD_RULES = {
  signedInOnly: true,
  thumbnailFirstOnCell: true,
} as const
