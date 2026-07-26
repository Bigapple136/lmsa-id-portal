-- sql/007_qr_audit.sql
-- Audit trail for QR key operations (rotation, revocation)
-- Run this in Supabase SQL Editor after 006_qr_keys.sql

-- Create audit table
CREATE TABLE IF NOT EXISTS qr_audit (
  id BIGSERIAL PRIMARY KEY,
  action TEXT NOT NULL CHECK (action IN ('rotate', 'revoke', 'rotate_started', 'revoke_started')),
  actor TEXT NOT NULL,
  kid TEXT,
  old_kid TEXT,
  new_kid TEXT,
  reason TEXT,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_qr_audit_kid ON qr_audit(kid);
CREATE INDEX IF NOT EXISTS idx_qr_audit_created_at ON qr_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qr_audit_action ON qr_audit(action);

-- RLS: service role only (no public access)
ALTER TABLE qr_audit ENABLE ROW LEVEL SECURITY;

-- No RLS policies needed — service role bypasses RLS.
-- If you need admin read access via Supabase, add:
-- CREATE POLICY "Admin can read audit"
--   ON qr_audit FOR SELECT
--   USING (auth.role() = 'authenticated');
-- But recommend keeping it service-role-only.