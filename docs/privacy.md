# Privacy (Platform V1)

This is the product privacy baseline. Counsel should sign a band-specific policy before go-live. Linked from login, this app’s `/privacy` screen, and (later) location, face opt-in, and print.

## Accounts

- Email, display name, **password hash** (scrypt). We never store the password.
- Reset tokens are hashed, expire in **one hour**, and are rate-limited.
- Sessions: **httpOnly** cookie. Sign out is obvious on Account (shared phones).
- Organizer/platform admins can set a **temporary password** (`must_reset_password`). Patrons and organizers can also request an **email reset link**.

## Anonymous first

You can browse a public band (tracker, gallery, guide — or their upsells) **without** an account. Password is for Library, saving your place near the truck, custom notifications, face, and print when those SKUs are live.

## Location (tracker contract)

Not collected in V1. When live:

- The **public** map is the truck, not patrons.
- Relative distance is on-device / signed-in. Organizer “nearby patrons” defaults **off**.
- Coarse/TTL storage only if this policy allows. **No sale** of location or ID.

## Library, face, print (later contracts)

- Library: signed-in uploads; view/download in-app; phone storage not required.
- Face: **opt-in**. Matches land in **your** Library. Paint/mud/night can miss.
- Print: we send **the image you chose** and the order to a partner. They do **not** get government ID or Tobago ID claims.

## Tobago ID (later)

Optional. V1 login shows **Tobago ID coming soon** (disabled). When linked: store `oidc_sub` and **minimum claims**. No ID documents. Same `users.id` as password.

## Retention / deletion

Account deletion and gallery wipe rules live in the band SOW and photos/face packages. Platform V1: contact the organizer or platform admin.
