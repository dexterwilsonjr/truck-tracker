# Fog Angels visual cleanup — September 8, 2026

Published to https://windies-truck-tracker.web.app/fog-angels.

The decorative background previously painted over ordinary text. It now sits
behind the content, with lighter secondary text and a correctly cropped logo.
The tracker uses a compact campaign header, status above the map, a shorter
mobile map, visible tile-loading feedback, a recenter control and a desktop
information column. Guide and Updates have clearer spacing and hierarchy.
The photo preview has working All photos / Pretty Mas / J’ouvert filters,
full-image viewing, readable captions and no unrelated patron upsell cards.

Validation: 9 local PostgreSQL API tests and 8 Chromium browser tests passed.
The Fog Angels production build, TypeScript checks and lint passed. A separate
320px-wide gallery check verified filter counts (8 total, 5 Pretty Mas, 3
J’ouvert), modal opening and Escape dismissal without horizontal overflow.
Mobile and desktop screenshots cover Tracker, Photos, Guide and Updates.
The final map-loading display was checked in the final browser screenshot run.
Vite still reports its expected large MapLibre chunk advisory.

Hosting release: `sites/windies-truck-tracker/releases/1788923046587000`.
Version: `sites/windies-truck-tracker/versions/2b01eafa818439f7`.
Previous version: `sites/windies-truck-tracker/versions/198ddbe8a70479d6`.
The deployment preserved the existing Hosting configuration and API rewrite.
Published index and service worker match the local production build; public
health and Fog Angels tracker requests returned HTTP 200. The crew is not
currently sharing a live position.

Evidence is in `artifacts/site-review/`; quotation text is in
`artifacts/quotes/fog-angels-line-items.txt`.

This cleanup does not implement the future contracted features: friend sharing,
push notifications, production gallery uploads or optional AI face matching.
The gallery clearly identifies itself as a preview. These features remain part
of the proposed delivery scope. Physical phone and event connectivity checks
remain necessary before declaring the full event service ready.
