/**
 * Brand configuration.
 *
 * The active pack is resolved from the client registry (`clients.ts`) so one
 * repository serves every band. Unset `VITE_BRAND` for local checks and
 * Playwright, which stay on the original pack.
 *
 *   VITE_BRAND=fog-angels npm run build:live
 *   unset VITE_BRAND  # original Truck Tracker / Tobago Carnival
 *
 * Do not fork the component set per band.
 */

export type { Brand, BrandContact, BrandPalette } from "./brands/types"
import { CLIENTS, DEFAULT_CLIENT_ID, clientById, type ClientApp } from "./clients"
import type { Brand } from "./brands/types"

export function clientIdFromEnv(raw: string | undefined = import.meta.env.VITE_BRAND): string {
  return raw && clientById(raw) ? raw : DEFAULT_CLIENT_ID
}

export const client: ClientApp = CLIENTS[clientIdFromEnv()]!
export const brand: Brand = client.brand

/** Push brand-derived CSS variables into :root so every token follows the active pack. */
export function installBrand(): void {
  const root = document.documentElement
  for (const [token, value] of Object.entries(brand.palette)) {
    root.style.setProperty(`--color-${token}`, value)
  }
  if (brand.fontDisplay) root.style.setProperty("--font-display", brand.fontDisplay)
  document.title = `${brand.productName} · ${brand.bandName}`
  const theme = document.querySelector('meta[name="theme-color"]')
  if (theme) theme.setAttribute("content", brand.palette.night)
  const description = document.querySelector('meta[name="description"]')
  if (description) description.setAttribute("content", `${brand.productName} — ${brand.tagline}`)
  if (brand.fontsHref) {
    let fonts = document.getElementById("brand-fonts") as HTMLLinkElement | null
    if (!fonts) {
      fonts = document.createElement("link")
      fonts.id = "brand-fonts"
      fonts.rel = "stylesheet"
      document.head.appendChild(fonts)
    }
    fonts.href = brand.fontsHref
  }
  if (brand.logoSrc) {
    const icon = document.querySelector('link[rel="icon"]')
    if (icon) icon.setAttribute("href", brand.logoSrc)
    let apple = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement | null
    if (!apple) {
      apple = document.createElement("link")
      apple.rel = "apple-touch-icon"
      document.head.appendChild(apple)
    }
    apple.href = brand.logoSrc
  }
}
