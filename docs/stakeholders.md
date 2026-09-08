# Stakeholder sign-off

Do not wait for every seat on Platform V1. Use the right reviewers per package.

| Seat | Why | Blocking for |
|---|---|---|
| **Band / mas camp producer** (buyer) | Meet points, marshals, costume collection, 4am behaviour | Any band SOW |
| **Section / truck marshal** | Last-known vs live, delayed messages, radio vs app | `truck_tracker` * |
| **Teltonika / installer** | Power, DIN1, sky view, APN, weekend sleep off, SIM | `truck_tracker` * |
| **Counsel (TT data protection)** | Location, minors in photos, face, print transfers, deletion | Platform V1 + `photos` / `face_mapping` / `print` * |
| **THA / TIDC** | Relying-party, scopes, branding | Tobago ID package * |
| **Insurer / event safety** | Public live truck; stale-as-live; camp 24/7 pin | `truck_tracker` * |
| **Print partner** | File spec, SLA, PII they will not receive | `print` * |
| **Mobile carrier / APN** | Data plan, congestion, roaming unknown | `truck_tracker` |
| **Accessibility** | 4am contrast, one-thumb, status captions | Platform + tracker |
| **Parent / band welfare** | Minors in photos and face match | `photos`, `face_mapping` * |
| **Windies finance / commercial** | SKU prices, hardware, SIM, R2 quotas | Platform V1 |
| **Security review** | Ingest, auth, R2, admin reset | First production deploy * |

**Platform V1:** counsel + commercial + buyer.

**Tracker:** marshal + installer + carrier + insurer.

**Photos / face:** welfare + counsel.

**Print:** the partner.
