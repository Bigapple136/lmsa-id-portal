-- sql/012_admin_actions_and_layout_history.sql
-- 1. General admin action audit log — records who did what, on which
--    record, and when, for admin-triggered mutations across the app.
-- 2. Layout version history — keeps recent saved layouts per side so a
--    bad save can be reverted without reconstructing it from git/logs.
-- Run this in Supabase SQL Editor after 011_students_confirmed_at.sql.

-- 1. admin_actions --------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_actions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      UUID REFERENCES admins(id) ON DELETE SET NULL,
  admin_email   TEXT, -- snapshot at time of action, so history survives the admin account being removed later
  action        TEXT NOT NULL,
  target_type   TEXT,
  target_id     TEXT,
  details       JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_actions_created_at ON admin_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_actions_target ON admin_actions(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_action ON admin_actions(action);

ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;
-- No RLS policies needed — backend uses the service role key, which
-- bypasses RLS. Keeping this service-role-only (no public/anon access).

-- 2. layout_history ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS layout_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  side            TEXT NOT NULL CHECK (side IN ('front', 'back')),
  value           JSONB NOT NULL,
  saved_by        UUID REFERENCES admins(id) ON DELETE SET NULL,
  saved_by_email  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_layout_history_side_created ON layout_history(side, created_at DESC);

ALTER TABLE layout_history ENABLE ROW LEVEL SECURITY;
-- Same as admin_actions: service-role-only, no public/anon access.
