# Friend sharing: 100-person live test

Band under test: **fog-angels**. This is the operating sheet for the test day.

## Build and deploy the right brand

`npm run build:live` produces the **original Truck Tracker** pack. Building it and deploying
ships the wrong name, the wrong palette, no client imagery, and a footer that says "sales
demo" to real patrons.

```sh
npm run build:live:fog                              # VITE_BRAND=fog-angels
firebase deploy --only hosting --project windies-app
```

Then confirm the running app, not the source: `document.title` should begin with the band's
product name, the footer must not contain "sales demo", and the guide should show the band's
contact links. `npm run live:links` checks every route and link afterwards.

`npm run check` deliberately does **not** build, so a local check cannot leave `dist/` in the
wrong brand. CI uses `npm run check:ci`, which does build.

## Current deployment state

- API revision `truck-tracker-api-00002-qzd` serving 100% of traffic. Rollback target is
  `truck-tracker-api-00001-kpb`:
  ```sh
  gcloud run services update-traffic truck-tracker-api --project windies-app \
    --region us-central1 --to-revisions truck-tracker-api-00001-kpb=100
  ```
- The migration has run. `connections`, `friend_positions`, `share_sessions`, `friend_invites`
  and `devices` exist in production with row level security enabled, and `bands` has
  `starts_at` / `ends_at`. No existing data was touched.
- `friends` is deliberately **not** entitled for any band, so it currently appears as an
  upsell. This is the scoped behaviour: the code ships, the SKU is sold.
- Live assurance against production passes: 44 checks, 0 failures, including that an
  unauthenticated caller sees no friend data and that no friend data reaches the public
  tracker or content endpoints.

## Still required before the test

1. **Set the event window.** Without it, sharing falls back to a 12-hour session and a
   90-day device enrolment. Ask the band for the dates; a wrong `ends_at` stops sharing
   mid-test.
2. **Grant the entitlement for that band** (step 3 below).
3. **Provision the accounts** (step 4 below). Run this in your own terminal: it prints the
   password, and credentials should not be pasted into a shared transcript or committed.
4. **Confirm the privacy position** with the band's counsel.

## Before the day

1. Deploy the API, then Hosting, per [demo.md](demo.md). `migrate()` runs on boot in one
   transaction; it is additive, but record the current Cloud Run revision first so traffic can
   be routed back.
   **Build the client's bundle, not the default one.** `npm run build:live` produces the
   original Truck Tracker pack, so the site shows the wrong name, the wrong palette, no client
   imagery, and the original footer's "sales demo" line to real patrons. For this band the build
   is:
   ```sh
   npm run build:live:fog      # VITE_BRAND=fog-angels
   firebase deploy --only hosting --project windies-app
   ```
   Then confirm `document.title` starts with the band's product name, and that the footer does
   not say "sales demo". A build-time brand pack is still how the web chrome works; the
   per-band database skin has not been wired to it yet.
2. Set the event window on the test band. This is what bounds sharing sessions and device
   enrolments, rather than the 12-hour and 90-day fallbacks:
   ```sql
   UPDATE bands SET starts_at = '<start>', ends_at = '<end>' WHERE slug = 'fog-angels';
   ```
3. Grant the friend-sharing entitlement deliberately. It is a sold SKU, not something a band
   gets automatically, so `seed` and `brand` will not add it:
   ```sql
   INSERT INTO band_entitlements (band_id, module_code, status, starts_at, ends_at)
   SELECT id, 'friends', 'active', now(), ends_at FROM bands WHERE slug = 'fog-angels'
   ON CONFLICT (band_id, module_code) DO UPDATE SET status = 'active', revoked_at = NULL;
   ```
4. Create the tester accounts and produce the handout:
   ```sh
   DATABASE_URL='<production URL>' ALLOW_PRODUCTION_TESTERS=true \
     TESTER_PASSWORD='<12+ chars>' npm run provision-testers -- fog-angels 100
   ```
   The script refuses any database whose name does not end in `_test` unless
   `ALLOW_PRODUCTION_TESTERS=true` is set, so this cannot happen by accident. Credentials are
   printed and never written to disk.
5. Confirm the privacy position with the band. Testers share real location, and
   [privacy.md](privacy.md) asks for a band-specific policy before go-live.
6. Run the live privacy assurance against the deployed URL and confirm an account with no
   connections sees nothing.

## Confirmed before the test

- 100 writers and 100 viewers were driven against an isolated database: 1000 requests, zero
  errors, p95 205ms for position writes and 269ms for the friends read, and no leaked database
  transactions afterwards. Local Postgres is faster than production, so treat these as a
  floor, not a forecast.

## Tester briefing

Say this plainly, because it is the behaviour testers will otherwise report as broken:

- **Keep this page open and the screen on.** Your location comes from the browser until the
  phone app is ready. Switching apps, locking the screen, or closing the tab stops your
  location, and you disappear from friends' maps until you come back.
- Press **Start sharing** when you want to be visible. Accepting an invite does not start it.
- Use **Show QR code** to pair. The link works once, so show it in person.
- **Stop sharing** removes you immediately. **Block** is permanent for that person.
- Signing out also stops sharing and disconnects the phone.

## During the test

Watch these, in order of how likely they are to be the real problem:

- Cloud Run instance count and error rate.
- Database connections: any sustained `idle in transaction` means a transaction is waiting on
  something while holding a connection — collect it rather than restarting and hoping.
- Active sharing sessions and visible positions per band.
- Tester reports of a pin that never appears, or one that stays after Stop sharing.

Re-run the live privacy assurance while the test is at full load.

## Success criteria

- At least 90 of the 100 testers appear on a friend's map.
- Median time from Start sharing to a visible pin under 10 seconds.
- p95 position age under 20 seconds while the page is visible.
- Zero authorization failures from the assurance checks, no 5xx, no pool exhaustion.

## Teardown

Clear the band's friend data, then remove the accounts and tell testers their data is deleted:

```sql
DELETE FROM friend_positions WHERE band_id = (SELECT id FROM bands WHERE slug = 'fog-angels');
DELETE FROM share_sessions   WHERE band_id = (SELECT id FROM bands WHERE slug = 'fog-angels');
DELETE FROM friend_invites   WHERE band_id = (SELECT id FROM bands WHERE slug = 'fog-angels');
DELETE FROM connections      WHERE band_id = (SELECT id FROM bands WHERE slug = 'fog-angels');
DELETE FROM devices          WHERE band_id = (SELECT id FROM bands WHERE slug = 'fog-angels');
DELETE FROM users WHERE email LIKE 'tester%@fog-angels.test';
```

Remove the `friends` entitlement afterwards unless the band has paid for it.

## Known limits, not bugs

- Browser GPS cannot run in the background. A locked or backgrounded phone disappears by
  design; the native app is what removes that limit.
- Automated tests use synthetic geolocation. Real accuracy, battery cost, and behaviour on a
  locked iPhone still need physical phones outdoors.
