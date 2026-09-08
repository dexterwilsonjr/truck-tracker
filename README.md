# Truck Tracker

Tobago Carnival band companion. **Platform V1** is a tenant shell: password
auth, entitlements, carnival brand, and **upsell screens for every SKU**.
Live GPS, R2, push, face, print, and Tobago ID wait on their own contracts.

The **sales demo** (no `VITE_API_URL`) is the existing polished mock app —
schematic map, local photos, demo admin. Production with the API set is
**not** a fake live map: every module shows an upsell until it is entitled
**and** that package is deployed.

Tagline: **Find the truck. Catch the vibe.**

## Run the sales demo

```bash
npm install
npm run dev        # http://localhost:5173
```

## Run Platform V1 (API + upsells)

```bash
cp .env.example .env
docker compose up db -d
npm run seed
npm run dev:server   # http://127.0.0.1:8787
```

In `.env` / Vite: `VITE_API_URL=http://127.0.0.1:8787`, then `npm run dev`.

Seed logins (change these): `platform@localhost` / `changeme` and
`organizer@localhost` / `changeme`. Band: `/tobago-carnival`.

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite SPA |
| `npm run dev:server` | Hono API |
| `npm run seed` | Bands, entitlements empty, admin users |
| `npm run build` | Type-check + production SPA |
| `npm run lint` | oxlint |

## Brand

Single file: `src/config/brand.ts` (council lock: midnight / gold / teal,
Space Grotesk + Inter). See `docs/brand.md`.

## Modules (separate contracts)

| Code | V1 | Later |
| --- | --- | --- |
| `truck_tracker` | Upsell | FMC920, MapLibre, marshal iPhone fallback |
| `updates` / `guide` | Upsell | Feed + meet-up |
| `photos` | Upsell + `/library` | Gallery + Library (R2) |
| `push` | Upsell | VAPID |
| `face_mapping` | Upsell | Opt-in match → Library |
| `print` | Upsell | Partner file + order |

Layout: `src/features/<module>/`, `server/modules/<module>/`, shared
`src/features/upsell/`, `server/auth`, `server/entitlements`,
`server/billing`.

Entitlements in Postgres are the **only** runtime switch. Entitled but not
in `server/modules/deployed.ts` → “Coming online”.

## Docs

- `docs/privacy.md` — also `/privacy` in the app
- `docs/deploy.md` — Vercel SPA, API, Neon; GPS port only with tracker
- `docs/fmc920.md` — hardware when tracker is contracted
- `docs/council-5star.md` — IA, honesty, a11y
- `docs/stakeholders.md` — who signs what
- `docs/tobago-id.md` — coming soon on login (disabled)

## Demo vs production admin

Demo `/admin` has **no** auth and is gated out of production builds
(`src/features/admin/gate.ts`). Live `/:bandSlug/admin` requires a
password. Platform entitlements: `/platform`.
