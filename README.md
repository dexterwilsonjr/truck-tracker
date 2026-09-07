# Truck Tracker

A polished, mobile-first **foundation** for a Tobago Carnival band app. Patrons
can find the band's truck, read updates, browse event details and preview
photos — entirely with **mock data** and **local previews**. Nothing here
connects to paid services or a production backend.

> Working title: **Truck Tracker** (branded `Tobago Carnival` until a real
> band — Fog Angels, Iconic Mas, … — is chosen).

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

Other scripts:

| Command          | What it does                         |
| ---------------- | ------------------------------------ |
| `npm run build`  | Type-check + production build        |
| `npm run preview`| Serve the production build locally   |
| `npm run lint`   | oxlint                               |

## Where to change branding

Everything brand-related lives in **one file**: `src/config/brand.ts`.

- `bandName`, `eventYear`, `eventLabel` — the band + event identity.
- `logoPlaceholder` — swap the gold monogram for the band's real logo.
- `palette` — colours; applied at runtime as CSS variables (defaults live in
  `src/index.css`), so every screen re-themes from this single object.
- `contact` + `registrationUrl` — leave empty to keep buttons in their
  friendly *"not set up yet"* state, or fill in live destinations.
- `productName` — the app name in the top bar.

No other band's logos, campaign artwork, sponsors or partnerships are
invented — placeholders are clearly labelled.

## Where the mock data lives

`src/data/mockData.ts` seeds announcements, truck state, the guide (meet-ups,
schedules, costume collection, FAQs) and sample gallery placeholders. All are
marked **sample/placeholder**. Types live in `src/types/models.ts`.

The demo service layer — `src/services/demoApi.ts` — is the only place screens
read/write data. It fakes network latency and persists non-sensitive demo
edits (read status, notification prefs, admin text/truck changes) to
`localStorage` under one key. **"Reset demo data"** (demo admin) wipes it and
re-seeds the samples.

## What is a demonstration

- **Tracker map** — a schematic SVG with truck + meet-up markers. It is
  labelled *"Demo map — not a real location"*. A demo control switches
  Live / Delayed / Signal lost; it never fakes a real GPS fix.
- **Show my location** — explains it isn't connected; never requests the
  location permission.
- **Updates** — seeded announcements; opening one marks it read locally.
  Notification toggles are saved locally only; push is not connected and no
  browser permission is requested.
- **Photos** — sample gradient tiles plus a local-only picker (JPEG/PNG/WebP,
  10 MB per image, 20 per selection). Selected files stay in memory as object
  URLs (released on removal/unmount), are never uploaded and never stored in
  `localStorage`.
- **Demo admin** (`/admin`, footer link) — announcements, event info, truck
  status + "Reset demo data". Changes update the patron screens locally.
  No authentication — do not enter private information. The route is disabled
  by default in production builds (`src/features/admin/gate.ts`).

## Where the real integrations connect later

| Feature              | Seam                                                            |
| -------------------- | --------------------------------------------------------------- |
| Live map + GPS feed  | Replace `src/features/tracker/MapPanel.tsx` internals with a map SDK fed by the tracking service |
| Band content/API     | Swap `demoApi` bodies for `fetch` calls — signatures stay stable |
| Authentication       | Not built; admin route stays demo-only until a real auth exists |
| Push notifications   | `src/features/updates` reads prefs; wire them to a push provider |
| Photo storage        | Upload flow in `src/features/photos` (local previews today)      |

## Structure

```
src/
  components/
    layout/     app shell, brand bar, bottom navigation
    ui/         button, card/chip, modal, segmented, toggle, field, icon…
  config/
    brand.ts    ← branding single source of truth
    labels.ts   display labels for model unions
  data/
    mockData.ts ← seeded sample content
  features/
    tracker/    find-the-truck: map, status card, demo signal control
    updates/    announcement feed + detail + notification prefs
    photos/     gallery, filters, lightbox, local add-photos flow
    guide/      event companion (meet-up, schedule, costume, FAQs, contact)
    admin/      demo admin preview (gated out of production builds)
  services/
    demoApi.ts  ← data-access layer to be replaced by a real API
  state/        DemoProvider store shared by patron + admin screens
  types/        typed data models
  App.tsx       routes
```

Built with React 19 + TypeScript + Vite + Tailwind CSS v4. Mobile-first with a
centred desktop layout; 4px spacing scale; reduced-motion support; modals
close with Escape and manage focus; all interactive targets ≥ 44 px.
