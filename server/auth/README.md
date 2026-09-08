# Auth (Platform V1)

Email + password. Sessions: httpOnly cookie (`tt_session`), HMAC-signed, 14-day TTL.

- Patrons: anonymous browse, or register/login for Library (when that SKU is live).
- Organizer `/admin` and platform `/platform`: password required.
- Forgot: email link (rate-limited), token hashed in `password_reset_tokens`.
- Admin reset: temporary password + `must_reset_password`.
- Tobago ID: **not implemented**. Login UI shows a disabled “Tobago ID coming soon” control. Store `users.oidc_sub` when a later OIDC package ships.
