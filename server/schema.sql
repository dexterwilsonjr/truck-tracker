CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS bands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  event_year integer NOT NULL DEFAULT 2026,
  event_label text NOT NULL DEFAULT 'J''ouvert & Pretty Mas',
  tagline text NOT NULL DEFAULT 'Find the truck. Catch the vibe.',
  brand jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  name text NOT NULL DEFAULT '',
  platform_role text NOT NULL DEFAULT 'patron'
    CHECK (platform_role IN ('patron', 'platform_admin')),
  oidc_sub text UNIQUE,
  must_reset_password boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS band_members (
  band_id uuid NOT NULL REFERENCES bands (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('organizer', 'marshal')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (band_id, user_id)
);

CREATE TABLE IF NOT EXISTS band_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid NOT NULL REFERENCES bands (id) ON DELETE CASCADE,
  module_code text NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked')),
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'custom_billing')),
  plan_code text,
  invoice_ref text,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  revoked_at timestamptz,
  revoke_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (band_id, module_code)
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS band_entitlements_band_idx ON band_entitlements (band_id);
CREATE INDEX IF NOT EXISTS password_reset_user_idx ON password_reset_tokens (user_id);
