-- =============================================================================
-- LMSA ID Portal — Correction details (015)
--
-- Structured payload for the student self-service flows:
--   * notifications.details — what a self-correction actually changed
--     (which fields, from what to what) plus the note the student wrote, so the
--     admin feed can say "Kofi Amankwah (STU-0042) corrected their full name,
--     year level and emergency contact phone" instead of "…requested
--     corrections to their details".
--   * confirmations.details — the same record on the student's activity-log
--     row, so per-field counts don't have to be re-parsed out of the note text.
--
-- Both are nullable with no backfill: rows written before this migration have
-- no structured version, and the code reads the legacy `message`/`note` text for
-- those. Realtime payloads carry the whole row, so the admin panel picks these
-- up with no further change.
--
-- Run this in the Supabase SQL Editor after
-- sql/014_template_zones_and_field_sides.sql. Idempotent: safe to re-run.
-- =============================================================================

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS details JSONB;
ALTER TABLE confirmations ADD COLUMN IF NOT EXISTS details JSONB;

-- admin_notifications lists columns explicitly so PostgreSQL can match old view
-- columns to new ones when the `details` column is added — `n.*` would fail
-- with a column rename error on re-creation.
CREATE OR REPLACE VIEW admin_notifications AS
SELECT
  n.id,
  n.type,
  n.title,
  n.message,
  n.student_id,
  n.is_read,
  n.created_at,
  nr.admin_id IS NOT NULL AS is_read_by_me,
  nr.read_at,
  n.details
FROM notifications n
LEFT JOIN notification_reads nr
  ON n.id = nr.notification_id
  AND nr.admin_id = auth.uid()
ORDER BY n.created_at DESC;

GRANT SELECT ON admin_notifications TO authenticated;
