# 5-star tracker (council) — encoded in V1

Binding for Platform V1 and for the tracker package when it ships.

## IA

Four patron tabs only: Tracker, Updates, Photos, Guide. Face / Print / Push are in-screen + `/upsell/:module`. **No cross-sell overlay on the live (or demo) map.**

## Upsell voices

Patron: “This band hasn’t turned this on yet.” Organizer: “Add this to the plan.” No SKU codes in patron copy. `src/features/upsell/catalog.ts`.

## Anonymous first

Seeing the truck (when live) does not require an account. Demo map stays labelled demo.

## Last-known / honesty

Never a blank map. Never label a schematic as live. Age of last update always visible. `signal-lost` and delayed use `aria-live="assertive"` on the status card. Tracker CTAs are **52px**.

## Safety copy (Guide)

Assistive location. Not 999. Marshals over the map. Meet-up vs truck stay distinct.

## Runtime

Entitlements in the database only. Entitled but not deployed → “Coming online”. No `VITE_MODULES` matrix.

## Demo vs production

`VITE_API_URL` unset = sales demo (this foundation). Set it = production V1 shell + upsells.
