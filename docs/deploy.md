# Deploy

## Platform V1 (this build)

No GPS port. No R2. No VAPID.

| Piece | Where |
|---|---|
| SPA | Vercel (or any static host). `npm run build` → `dist/` |
| API | Node 22 on a small VPS or a Node host. `npm run dev:server` / `tsx server/index.ts` |
| Postgres | Neon (or Docker `docker compose up db`) |

### Frontend env

```
VITE_API_URL=https://api.example.com
```

Unset `VITE_API_URL` for the **sales demo** (mock data, schematic map). Production V1 with the API set is branded shell + upsells, not a fake live map.

Demo admin (`/admin` or `/demo/admin`) is **not** authentication. It is disabled in production builds unless `VITE_ENABLE_DEMO_ADMIN=true`. Live organizer admin is password-only at `/:bandSlug/admin`.

### API env

See `.env.example`. Required in production: `DATABASE_URL`, `SESSION_SECRET`, `FRONTEND_ORIGIN`. Mail: `RESEND_API_KEY` (or log-only in development).

```
npm run seed
npm run dev:server   # http://127.0.0.1:8787
```

SPA `vite` proxies nothing by default — point `VITE_API_URL` at the API origin. CORS allows `FRONTEND_ORIGIN` with credentials.

## Per-package (when that contract ships)

| Package | Extra |
|---|---|
| `truck_tracker` | VPS TCP **:5027** (Caddy stream or firewall allowlist). Neon write volume. IMEI **never** in the SPA. See `docs/fmc920.md`. |
| `photos` | Cloudflare R2 (or S3). Presigned PUT. See `docs/r2.md`. |
| `push` | VAPID keys + PWA service worker. See `docs/vapid.md`. |
| `print` | Partner webhook + file POST. See `docs/print-partner.md`. |
| Tobago ID | Redirect URI at TIDC. See `docs/tobago-id.md`. |

## Event-day notes

Patron snapshot should be cacheable. Tracker poll only while the Tracker tab is visible. GPS ingest (later) must not share a jammed Node loop with photo uploads.
