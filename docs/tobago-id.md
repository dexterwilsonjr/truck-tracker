# Tobago ID (later)

[id.tha.tt](https://id.tha.tt) is **not** the default login.

**V1:** login/register show a **disabled** control: **Tobago ID coming soon**. It must not start OIDC.

When TIDC/THA public OIDC exists:

- Control becomes **Sign in with Tobago ID**.
- Link to an existing password user via `users.oidc_sub`.
- Store minimum claims. No ID documents.
- Redirect URI registered with TIDC. Same `users.id` for Library / face / print.
