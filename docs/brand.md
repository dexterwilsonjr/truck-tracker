# Brand guide (V1 council lock)

Tokens live in `src/config/brand.ts` and `src/index.css`. One palette object. Bands override at runtime. No second theme file. No light mode.

| Token | Hex |
|---|---|
| night | `#070b15` |
| panel | `#0d1424` |
| raised | `#151e33` |
| line | `#23304d` |
| ink | `#f3f5fb` |
| muted | `#98a3ba` |
| faint | `#626f8c` |
| gold | `#eab84c` |
| goldink | `#221703` |
| teal | `#31d6bd` |
| live | `#3ddc97` |
| warn | `#f5a524` |
| sky | `#74b3ff` |
| danger | `#f87171` |

Gold = primary CTA / find the truck. Teal = location / meet-up. Live/warn/danger = status only.

Display: **Space Grotesk**. Body: **Inter**. Cards: `--radius-card` 1.25rem. Bottom nav pill. Tracker primary actions **52px**. Other controls ≥ 44px. Gold buttons use `goldink`. Respect `prefers-reduced-motion`.

Voice: short Trinidad English, present tense. Never “SKU” or “enable module” to patrons.

Product name: **Truck Tracker**. Tagline: **Find the truck. Catch the vibe.**

## Clients

Every band is one entry in `src/config/clients.ts`, which pairs a brand pack with the
app identity (display name and bundle identifier) that a Transistorsoft licence key binds to.
Bands are data, not deployments: one repository, one API, one database serve all of them.

Adding a paying band:

1. Add `src/config/brands/<id>.ts` for the palette, logo, fonts, copy and meetup.
2. Register it in `src/config/clients.ts`. Keep `appId` final, because licence keys cannot be
   re-bound to a different identifier without a regeneration request.
3. Add icon and splash assets under `public/brands/<id>/`.
4. Run `npm run brand -- <id>`. It upserts the band row (including the full skin in
   `bands.brand`), the truck, the content, and an entitlement per deployed module. Re-running is
   safe and is the normal pre-event step.
5. Build that client with `VITE_BRAND=<id> npm run build:live`.

The original tokens above remain the default when `VITE_BRAND` is unset.
See [demo.md](demo.md) to switch the live site and switch it back.
