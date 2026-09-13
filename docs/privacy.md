# Privacy (1.2)

This is the product privacy baseline. Counsel should sign a band-specific policy before go-live. Linked from login, this app’s `/privacy` screen, and (later) location, face opt-in, and print.

## Who operates this

The platform is operated by **Windies Media Ltd.**, which is the data controller for the
platform accounts and for the public event content it hosts on a band's behalf.

To confirm before go-live, from the company registry: registered number, registered office,
and the jurisdiction whose data protection law applies. A privacy policy that does not
identify its controller or provide a contact route is incomplete.

Where friend location sharing is used, the band whose event it is also has obligations, and
a band-specific policy should name them. This document is the platform baseline, not the
band's policy.

For any request under this policy — access, correction, deletion, or a complaint — contact
`[PRIVACY CONTACT]`, which must be a monitored address before the pilot.

## Accounts

- Email, display name, **password hash** (scrypt). We never store the password.
- Reset tokens are hashed, expire in **one hour**, and are rate-limited.
- Sessions: **httpOnly** cookie. Sign out is obvious on Account (shared phones).
- Organizer/platform admins can set a **temporary password** (`must_reset_password`). Patrons and organizers can also request an **email reset link**.

## Anonymous first

You can browse a public band (tracker, gallery, guide — or their upsells) **without** an account. Password is for Library, saving your place near the truck, custom notifications, face, and print when those SKUs are live.

## Location

Two different things collect location, and they are kept apart.

### The band truck (public)

Crew phone GPS is collected while sharing is active:

- The **public** map is the truck, not patrons. Anyone can open it without an account.
- End live deletes the stored truck positions. Active ingestion prunes positions older than 24 hours; older positions are excluded from public snapshots.
- Public event copy may be cached offline; precise truck locations and account responses are excluded.

### Find your friends (private, opt-in)

Friend sharing is off until you turn it on, and it lasts only for the event.

- **You start it.** Signing in, joining an event, or accepting an invite never starts collection. Sharing runs from the moment you press Start sharing until it ends.
- **Who can see you.** Only people you have an accepted connection with, in that band, and only while you are sharing. Every read is authorised on the server against the current connection and sharing session — the app never decides who sees you.
- **It ends by itself.** A sharing session has a fixed end at the event boundary. It also ends the moment you press Stop sharing, remove a friend, or block someone.
- **We keep the latest position only.** A private position is overwritten in place rather than kept as a route history, and stopping sharing deletes it immediately.
- **Logging out stops it.** Signing out, resetting a password, or changing a password ends your sharing sessions and deletes your stored position.
- **Blocking works both ways.** Blocking someone permanently ends that connection: they stop seeing you, you stop seeing them, and a new invite cannot reconnect the pair.
- **Never public, never sold.** Private positions never appear on the public truck map, are excluded from offline caches, notification payloads and analytics, and are not sold or shared with third parties.

## Sign-off

Signed off by the operator on **12 September 2026** for the Fog Angels pilot (100 testers).

Scope of that sign-off: the consent, visibility, retention and revocation behaviour described
above, as implemented. It is an operator sign-off, not counsel review. A band-specific version
covering the exact event window and retention period should still be reviewed before full
event use, and the pilot is the rehearsal for it.

## Library, face, print (later contracts)

- Library: signed-in uploads; view/download in-app; phone storage not required.
- Face: **opt-in**. Matches land in **your** Library. Paint/mud/night can miss.
- Print: we send **the image you chose** and the order to a partner. They do **not** get government ID or Tobago ID claims.

## Tobago ID (later)

Optional. V1 login shows **Tobago ID coming soon** (disabled). When linked: store `oidc_sub` and **minimum claims**. No ID documents. Same `users.id` as password.

## Retention / deletion

Account deletion and gallery wipe rules live in the band SOW and photos/face packages. Platform V1: contact the organizer or platform admin.
