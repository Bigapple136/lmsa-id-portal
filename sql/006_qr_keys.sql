-- =============================================================================
-- LIMSA ID Portal — Migration 006: Key-rotatable QR signing keys
--
-- Introduces a `qr_keys` table so the QR signing secret can be rotated without
-- invalidating every card in the field. The current `QR_SIGNING_SECRET` env
-- value is seeded here as `k_legacy` (status='active'), preserving all
-- already-issued cards and tokens.
--
-- Key states:
--   active  — used to sign new tokens; accepted for verification
--   retired — NOT used to sign; still accepted for verification
--   revoked — NOT used to sign; REJECTED for verification (403)
--
-- The single-active-key invariant is enforced by a partial unique index, so the
-- rotation transaction (insert new active + update previous active -> retired)
-- must wrap both statements or the second will fail on the index.
--
-- Safe to run on existing data. Re-runnable: ON CONFLICT / IF NOT EXISTS.
-- =============================================================================

-- 1. qr_keys table -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS qr_keys (
  kid          TEXT PRIMARY KEY,                       -- e.g. 'k_legacy', 'k_2025_11'
  secret       TEXT NOT NULL,                          -- >= 32 chars (base64url or random)
  status       TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'retired', 'revoked')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  rotated_at   TIMESTAMPTZ,                             -- moved active -> retired
  revoked_at   TIMESTAMPTZ,                             -- moved (active|retired) -> revoked
  rotated_from TEXT REFERENCES qr_keys(kid)             -- the key this one replaced
);

-- At most one active signing key at a time. Partial unique index on a constant
-- expression is the standard Postgres idiom for "exactly one row matches X".
CREATE UNIQUE INDEX IF NOT EXISTS qr_keys_one_active
  ON qr_keys ((1)) WHERE status = 'active';

-- 2. Seed k_legacy from the current env secret --------------------------------
-- Replace 'YOUR_QR_SIGNING_SECRET_HERE' with your current QR_SIGNING_SECRET value
-- (>= 32 chars, base64url or random) before running. After this migration, the env
-- var becomes a dev-only fallback (see qr-keys.js). Re-running with a different
-- secret has no effect because of ON CONFLICT DO NOTHING — to actually change it,
-- perform a rotation instead.
INSERT INTO qr_keys (kid, secret, status)
VALUES ('k_legacy', 'YOUR_QR_SIGNING_SECRET_HERE', 'active')
ON CONFLICT (kid) DO NOTHING;

-- 3. Audit -------------------------------------------------------------------
-- Row Level Security: keep the secrets table inaccessible to anon/auth clients;
-- only the service key (used by the backend) should read it. The service role
-- bypasses RLS regardless, but RLS prevents accidental exposure via the anon key
-- or a misconfigured public client.
ALTER TABLE qr_keys ENABLE ROW LEVEL SECURITY;
-- No policies are defined — anon/auth roles get nothing; service role bypasses.
