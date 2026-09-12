# Truck Tracker 1.2 release runbook

Live client demo: https://windies-truck-tracker.web.app

Target: dedicated Firebase site `windies-truck-tracker` in `windies-app`, with
Cloud Run `truck-tracker-api` in `us-central1`. These are separate from Windies OS.

Retrieve demo logins (do not commit or paste them into chat):

```sh
gcloud secrets versions access latest --secret=truck-tracker-seed --project windies-app
```

- Patron: no account. Open `/fog-angels` (Fog Angels demo) or `/tobago-carnival` after swapping back.
- Crew / organizer: `SEED_ORGANIZER_EMAIL` from that secret, then `/fog-angels/admin`.
- Platform: `PLATFORM_ADMIN_EMAIL` from that secret, then `/platform`.

## Before deployment

1. Provision a dedicated Supabase database connection and store it as
   `truck-tracker-db-url` in Secret Manager. Never point this app's migration at
   the existing Windies OS database. Use a server-only database role.
2. Store a random 32+ character secret as `truck-tracker-session-secret` and a
   verified Resend key as `truck-tracker-resend-key`.
3. Configure `MAIL_FROM` for a verified sending domain and set
   `FRONTEND_ORIGIN=https://windies-truck-tracker.web.app`.
4. Provision organizer and platform emails with unique passwords using protected
   environment variables, then run `npm run seed` against the dedicated database.
   Reseeding preserves existing passwords. Do not publish credentials in git,
   logs, or this runbook. Users with temporary passwords must change them first.
5. Confirm the meeting reference and content. Seed data explicitly marks dates,
   times and the exact meeting point as unconfirmed.
6. Run `npm run check` and `npm run test:e2e` with the isolated test database.

The API uses a random, revocable `__session` cookie because Firebase Hosting
forwards that cookie name to Cloud Run. Mutations require the configured origin.
The API and all authenticated responses use `Cache-Control: no-store`.

## Deploy

```sh
npm run build:live

gcloud run deploy truck-tracker-api --project windies-app \
  --region us-central1 --source . --allow-unauthenticated \
  --min-instances 1 --max-instances 3 --memory 512Mi --port 8080 \
  --service-account truck-tracker-runtime@windies-app.iam.gserviceaccount.com \
  --set-env-vars NODE_ENV=production,FRONTEND_ORIGIN=https://windies-truck-tracker.web.app,MAIL_FROM="Truck Tracker <noreply@windiesgroup.com>" \
  --set-secrets DATABASE_URL=truck-tracker-db-url:latest,SESSION_SECRET=truck-tracker-session-secret:latest,RESEND_API_KEY=truck-tracker-resend-key:latest

firebase deploy --only hosting --project windies-app
```

Use a dedicated Cloud Run service account with access only to the three tracker
secrets. Confirm site availability before using its URL in secrets/configuration.
Replace VERIFIED_SENDER with the verified address. Do not deploy the frontend
until the API is healthy and the target database is seeded.

## Acceptance on the deployed site

- `/api/health` returns version `1.2.0` and a healthy database connection.
- An anonymous phone opens Tracker, sees Tobago and no truck pin before go-live.
- Updates and Guide contain usable, clearly qualified event information.
- Sign in as crew on a second phone. Go live, send one location, then Keep sharing.
- Patron pin moves; source and last-update age are visible. No patron location
  leaves the patron's device.
- Delay plus a message updates the patron status. Pause/hidden page stops phone
  posts; after 30 seconds the patron sees signal lost.
- End live removes the pin. A late post from the old sharing session is rejected.
- Deny location permission and verify readable guidance without a broken page.
- End live and log out, then verify authenticated endpoints reject the old cookie.
- Exercise a real recovery email, password change and session invalidation.
- Visit Guide, disconnect, then reopen it: cached public content is labelled.
  Truck coordinates and authenticated API responses must never enter offline caches.
- Photos remains unavailable in production. Local demo previews are not uploads.

Before full event use, test on actual iPhone and Android devices, in sunlight and
with congested connectivity. Automated location tests do not establish phone
background behavior or physical GPS accuracy.

## Rollback and operations

Record the previous Cloud Run revision and Firebase release before publishing.
If a smoke test fails, route Cloud Run traffic to that revision and roll back the
Firebase release in its console. Additive schema changes preserve existing data;
do not drop tables during rollback. End sharing before operational maintenance.
Check Cloud Run error logs and database health without logging passwords, reset
links or GPS request bodies. Positions older than 24 hours are pruned on new
location writes; schedule deletion for inactive trucks as well before event use.

## Fog Angels client skin

The original Truck Tracker / Tobago Carnival pack stays in `src/config/brands/original.ts`.
Fog Angels lives in `src/config/brands/fog-angels.ts`. Do not fork screens; switch packs.

**On (live demo for the band leader)**

```sh
DATABASE_URL="$(gcloud secrets versions access latest --secret=truck-tracker-db-url --project windies-app)" \
  npm run brand -- fog-angels
npm run build:live:fog
# then publish the `dist/` Hosting release as usual
```

Crew admin stays on the same band row; only slug/name/copy/meetup/chrome change.
Old `/tobago-carnival` URLs redirect to `/fog-angels` while this skin is built.

**Off (restore original)**

```sh
DATABASE_URL="$(gcloud secrets versions access latest --secret=truck-tracker-db-url --project windies-app)" \
  npm run brand -- original
npm run build:live
# then publish Hosting
```

Leave `VITE_BRAND` unset for local checks and Playwright. Those stay on Tobago Carnival.
