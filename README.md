# Truck Tracker

Tobago Carnival band companion. **1.2** adds MapLibre tracking from a crew
phone, authenticated sharing controls, read-only Updates and Guide, and account
security improvements. R2, push, face matching, print, FMC920 ingestion and Tobago
ID remain future packages.

With `VITE_API_URL` unset, the local sales demo uses mock data. With the API
configured, entitled and deployed modules use the live 1.2 implementation.
See [release evidence](docs/release-1.2.md) for deployment status.

Tagline: **Find the truck. Catch the vibe.**

## Run the sales demo

```bash
npm install
npm run dev        # http://localhost:5173
```

## Run 1.2 locally

```bash
cp .env.example .env
docker compose up db -d
# Edit .env: set unique seed passwords of at least 12 characters.
npm run seed
npm run dev:server   # http://127.0.0.1:8787
```

In `.env` / Vite: `VITE_API_URL=http://127.0.0.1:8787/api`, then `npm run dev`.

Seed account emails and passwords come from your `.env`; credentials are never
printed. Reseeding preserves existing passwords. Band: `/tobago-carnival` (or `/fog-angels` when that skin is applied).

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite SPA |
| `npm run dev:server` | Hono API |
| `npm run seed` | Band, phone tracker, public content and admin users |
| `npm run brand` | Provision a client band (`<clientId>` from `src/config/clients.ts`) |
| `npm run build` | Type-check + production SPA |
| `npm run lint` | oxlint |
| `npm run build:live` | Firebase build, original brand |
| `npm run build:live:fog` | Firebase build, Fog Angels skin |
| `npm run check` | API tests, lint and live build |
| `npm run test:e2e` | Browser and two-session GPS checks |

## Brand and clients

Every client band is one entry in `src/config/clients.ts`: a brand pack, an app name, and the
bundle identifier that a Transistorsoft licence key is bound to.

To add a paying band:

1. Add `src/config/brands/<id>.ts` with the palette, logo, fonts, contact, guide, updates and meetup.
2. Register it in `src/config/clients.ts` with its `appName` and `appId`.
3. Put icon, splash and imagery in `public/brands/<id>/`.
4. `npm run brand -- <id>` to provision the band row, truck, content and entitlements. Idempotent.
5. `VITE_BRAND=<id> npm run build:live` for that client's bundle.

One repository, one API, one database. A second band is never a second deployment.

Default (unset `VITE_BRAND`): Truck Tracker / Tobago Carnival. See `docs/brand.md` and `docs/demo.md`.

## Modules (separate contracts)

| Code | 1.2 | Later |
| --- | --- | --- |
| `truck_tracker` | MapLibre + crew phone GPS | FMC920 ingestion |
| `updates` / `guide` | Seeded read-only content | Organizer content editing |
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
- `docs/demo.md` — Firebase/Cloud Run deployment and two-phone acceptance
- `docs/release-1.2.md` — verification evidence and outstanding gates
- `docs/deploy.md` — historical V1 deployment notes
- `docs/fmc920.md` — hardware when tracker is contracted
- `docs/council-5star.md` — IA, honesty, a11y
- `docs/stakeholders.md` — who signs what
- `docs/tobago-id.md` — coming soon on login (disabled)

## Demo vs production admin

Demo `/admin` has **no** auth and is gated out of production builds
(`src/features/admin/gate.ts`). Live `/:bandSlug/admin` requires a
password. Platform entitlements: `/platform`.
