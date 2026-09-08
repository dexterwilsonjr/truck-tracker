# Entitlements

`band_entitlements` is the **only** runtime switch. There is no `VITE_MODULES` matrix.

Live module = `status = active` **and** the package is listed in `server/modules/deployed.ts`.

If entitled but not deployed → frontend “Coming online” upsell. API SKU routes return `403 module_not_entitled` (or `503 not_deployed` if entitled in a later mismatch).
