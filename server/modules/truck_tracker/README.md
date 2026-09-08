# Truck Tracker (`truck_tracker`)

**Status:** contract package. **Not in Platform V1.** Routes render the upsell until a band is entitled **and** this package is deployed.

## What this SKU is

Live map of the band truck for anonymous patrons. Last-known is the product. Marshals stay the authority.

## Hardware

- **Default GPS:** Teltonika **FMC920** (Codec 8 / 8E, one SIM).
- **Optional dual-SIM later:** **FMC125** (Digicel + bmobile), same ingest. Not Starlink-as-GPS.
- **Starlink:** optional WiFi for marshal phone / camp uploads. Does **not** plug into the FMC920.

See `docs/fmc920.md`.

## Marshal iPhone fallback

Authenticated organizer/marshal only. One-shot or share-while-page-open. Label: **Updated from a marshal’s phone**. FMC920 wins when it returns. Screen stays on. HTTPS + Precise Location.

## Patron rules

- No account required to see the truck.
- No public patron dots. Relative distance is signed-in / on-device.
- Never overlay “More from Truck Tracker” on the live map.
- Status card is the a11y source of truth (`aria-live` polite; assertive for delayed / signal-lost).
- Human distance, not fake metres. Age of last fix always visible.

## Schema (when contracted)

`trucks`, `positions` (`source`, UTC timestamps). Display `America/Port_of_Spain`.
