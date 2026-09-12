-- gen_random_uuid() is built into supported PostgreSQL versions.

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

-- 1.2 additions are idempotent; existing V1 rows are retained.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS rate_limits (
  key text PRIMARY KEY, hits integer NOT NULL, expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_limits_expiry_idx ON rate_limits(expires_at);
CREATE INDEX IF NOT EXISTS band_members_user_idx ON band_members(user_id);
CREATE TABLE IF NOT EXISTS trucks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid NOT NULL UNIQUE REFERENCES bands(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Band truck',
  public_live boolean NOT NULL DEFAULT false,
  live_since timestamptz,
  share_id uuid,
  status text NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'delayed')),
  message text NOT NULL DEFAULT '',
  meetup_lat double precision NOT NULL DEFAULT 11.182,
  meetup_lng double precision NOT NULL DEFAULT -60.735,
  meetup_label text NOT NULL DEFAULT 'Scarborough — exact meeting point to be confirmed'
);
CREATE TABLE IF NOT EXISTS positions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  truck_id uuid NOT NULL REFERENCES trucks(id) ON DELETE CASCADE,
  share_id uuid NOT NULL,
  lat double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng double precision NOT NULL CHECK (lng BETWEEN -180 AND 180),
  heading double precision,
  accuracy_m double precision NOT NULL CHECK (accuracy_m BETWEEN 0 AND 200),
  source text NOT NULL CHECK (source IN ('phone_fallback', 'fmc920')),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS positions_latest_idx ON positions(truck_id, share_id, recorded_at DESC);
CREATE TABLE IF NOT EXISTS band_content (
  band_id uuid PRIMARY KEY REFERENCES bands(id) ON DELETE CASCADE,
  updates jsonb NOT NULL DEFAULT '[]'::jsonb,
  guide jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS module_requests (
  band_id uuid NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  module_code text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(band_id, module_code)
);

-- Supabase's public REST roles must not read or mutate server-owned tables.
-- The API connects as the table-owning server role; no public RLS policies exist.
ALTER TABLE bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE band_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE band_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE trucks ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE band_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_requests ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Friend sharing
--
-- Private patron positions are deliberately kept out of `positions` and away
-- from the public truck endpoints. They live in their own latest-only table so
-- there is no route history to leak, and so no reader of the truck tables can
-- surface a patron by accident.
-- ---------------------------------------------------------------------------

-- Event window. Friend sharing is band/event scoped, so a sharing session can
-- never outlive the event it belongs to.
ALTER TABLE bands ADD COLUMN IF NOT EXISTS starts_at timestamptz;
ALTER TABLE bands ADD COLUMN IF NOT EXISTS ends_at timestamptz;

-- One row per invite link or QR code. Tokens are hashed at rest, single use,
-- and expire, following the password_reset_tokens pattern.
CREATE TABLE IF NOT EXISTS friend_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid NOT NULL REFERENCES bands (id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  accepted_by uuid REFERENCES users (id) ON DELETE SET NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS friend_invites_band_idx ON friend_invites (band_id);
CREATE INDEX IF NOT EXISTS friend_invites_inviter_idx ON friend_invites (inviter_id);

-- A friendship. Blocking is recorded on the row itself so a blocked pair can
-- never be reconnected by a fresh invite.
--
-- There is no 'pending' state: an invite link is created by someone who has
-- already consented to share, and accepting it is the other person's explicit
-- consent, so the connection is mutual the moment it is accepted.
CREATE TABLE IF NOT EXISTS connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid NOT NULL REFERENCES bands (id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'accepted'
    CHECK (status IN ('accepted', 'blocked', 'removed')),
  blocked_by uuid REFERENCES users (id) ON DELETE SET NULL,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (requester_id <> addressee_id)
);
-- One pair per band regardless of who invited whom.
CREATE UNIQUE INDEX IF NOT EXISTS connections_pair_idx
  ON connections (band_id, LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));
CREATE INDEX IF NOT EXISTS connections_addressee_idx ON connections (addressee_id);
-- The visibility join matches a connection in either direction, so both
-- columns need an index or half the join scans.
CREATE INDEX IF NOT EXISTS connections_requester_idx ON connections (requester_id);

-- An explicit, finite sharing session. Nothing is visible without one, so
-- accepting an invite never starts collection on its own.
CREATE TABLE IF NOT EXISTS share_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  band_id uuid NOT NULL REFERENCES bands (id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  ended_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > started_at)
);
-- At most one open session per person per band, so two devices cannot compete
-- as the writer for one identity.
CREATE UNIQUE INDEX IF NOT EXISTS share_sessions_open_idx
  ON share_sessions (user_id, band_id) WHERE ended_at IS NULL AND revoked_at IS NULL;

-- Latest position only: one row per person per band, overwritten in place.
-- No route history is retained by design.
CREATE TABLE IF NOT EXISTS friend_positions (
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  band_id uuid NOT NULL REFERENCES bands (id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES share_sessions (id) ON DELETE CASCADE,
  lat double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng double precision NOT NULL CHECK (lng BETWEEN -180 AND 180),
  accuracy_m double precision NOT NULL CHECK (accuracy_m BETWEEN 0 AND 200),
  heading double precision CHECK (heading IS NULL OR (heading >= 0 AND heading < 360)),
  motion_state text NOT NULL DEFAULT 'unknown'
    CHECK (motion_state IN ('moving', 'stationary', 'unknown')),
  source text NOT NULL DEFAULT 'native'
    CHECK (source IN ('browser', 'native')),
  captured_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  location_uuid uuid,
  PRIMARY KEY (user_id, band_id)
);
CREATE INDEX IF NOT EXISTS friend_positions_band_idx ON friend_positions (band_id);

-- A native install. Tokens are opaque, hashed at rest, and revocable, and are
-- kept separate from the browser session cookie.
--
-- Enrolment is scoped to one band's event, the same way a sharing session is,
-- so a token cannot outlive the event it was issued for and cannot be used to
-- post into a different band.
CREATE TABLE IF NOT EXISTS devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  band_id uuid NOT NULL REFERENCES bands (id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  platform text NOT NULL CHECK (platform IN ('ios', 'android')),
  push_token text,
  app_version text,
  expires_at timestamptz NOT NULL,
  active boolean NOT NULL DEFAULT true,
  revoked_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS devices_user_idx ON devices (user_id);
CREATE INDEX IF NOT EXISTS devices_user_band_idx ON devices (user_id, band_id);
CREATE INDEX IF NOT EXISTS devices_expiry_idx ON devices (expires_at);

ALTER TABLE friend_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

-- Devices were briefly created without an event scope. CREATE TABLE IF NOT
-- EXISTS does not alter an existing table, so bring older databases forward and
-- invalidate any token that predates the scope rather than granting it a
-- lifetime it was never issued for.
ALTER TABLE devices ADD COLUMN IF NOT EXISTS band_id uuid REFERENCES bands (id) ON DELETE CASCADE;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS expires_at timestamptz;
DELETE FROM devices WHERE band_id IS NULL OR expires_at IS NULL;
ALTER TABLE devices ALTER COLUMN band_id SET NOT NULL;
ALTER TABLE devices ALTER COLUMN expires_at SET NOT NULL;
CREATE INDEX IF NOT EXISTS devices_user_band_idx ON devices (user_id, band_id);
CREATE INDEX IF NOT EXISTS devices_expiry_idx ON devices (expires_at);

-- friend_positions briefly shipped without a source. A browser and a native app
-- have different reliability, so the writer is recorded rather than assumed.
-- Existing rows came through the native ingest contract, hence the default.
ALTER TABLE friend_positions ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'native';
ALTER TABLE friend_positions DROP CONSTRAINT IF EXISTS friend_positions_source_check;
ALTER TABLE friend_positions ADD CONSTRAINT friend_positions_source_check
  CHECK (source IN ('browser', 'native'));
