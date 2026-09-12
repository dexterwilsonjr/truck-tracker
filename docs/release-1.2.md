# 1.2 release evidence

Status: 1.2 is live at https://windies-truck-tracker.web.app. Phone GPS is the
active writer; FMC920 ingestion, R2, push, face matching, print and OIDC remain
deferred. A real two-phone / iPhone permission walkthrough is still required
before treating this as event-day ready.

## Implemented

- Revocable server sessions, forced temporary-password changes, atomic recovery,
  cross-band reset restrictions, persisted rate limits and bounded input validation.
- Production configuration validation, protected reseeding, no credential logging.
- Tracker data/API, live sharing generations, freshness states and band isolation.
- MapLibre patron map, private on-device location, crew sharing and visibility pause.
- Seeded read-only Updates and Guide, local public-content cache and shell worker.
- Request timeouts and visible failures, photo-preview ownership and total limits.
- Organizer feature requests, paginated admin lists and batched entitlements.
- Lazy routes, CI checks, API integration and mobile browser regression suites.

## Deployment gates

- Dedicated Supabase connection and verified transactional mail configuration.
- Dedicated Cloud Run service account, service and Firebase site.
- Passing local checks and deployed API/cookie/email smoke tests.
- Real two-phone walkthrough and actual iPhone permission/visibility behavior.

No passing local test should be reported as evidence of a successful deployment.

## Verified on September 8, 2026

- 9 real PostgreSQL integration tests pass, including cross-band reset denial,
  forced password changes, concurrent recovery, session revocation, tracker
  privacy, entitlement time boundaries and public-role isolation.
- 8 Chromium browser tests pass, including the two-session crew/patron workflow
  against the real local API and PostgreSQL, location denial, and a fully
  offline Guide reload from the shell service worker.
- Production build/type checks and lint pass with no lint warnings.
- Linux amd64 Docker image builds successfully.
- Main live application bundle is approximately 104 KB compressed, down from
  117 KB. MapLibre is a separate approximately 271 KB compressed map chunk;
  Vite reports the expected large-chunk advisory for that renderer.
- Dedicated Firebase site `windies-truck-tracker` is serving
  https://windies-truck-tracker.web.app. Cloud Run `truck-tracker-api` is healthy
  (`/api/health` version `1.2.0`), same-origin login sets a Secure `__session`
  cookie, and the public tracker reports not-live with a Scarborough meet-up.
  Windies OS was not changed.

## Infrastructure

Dedicated Supabase project `truck-tracker` (org Windies) is stored as
`truck-tracker-db-url`. Session, Resend, and seed secrets exist in Secret Manager.
The saved Windies OS database URL was not used.
