-- sql/014_template_zones_and_field_sides.sql
-- Consolidates supabase/migrations/20260812_add_template_zones_and_layout.sql
-- into the numbered migration sequence — that file lived in a second,
-- untracked migration location (Supabase CLI's default folder) that had
-- drifted out of sync with this sql/ folder, which is what every other
-- migration in this repo is actually tracked and applied from. Found during
-- the production-readiness review.
--
-- Both statements below are idempotent (ADD COLUMN IF NOT EXISTS,
-- INSERT ... ON CONFLICT DO NOTHING), so this is safe to run even though
-- the columns and seed row almost certainly already exist in production —
-- backend/routes/templates.js actively selects/inserts zones_front,
-- zones_back, suggested_layout_front, and suggested_layout_back today,
-- which wouldn't be possible in production without this having already
-- been applied by some other means.
--
-- supabase/migrations/ has been removed from the repo — sql/ is the one
-- tracked migration location going forward.

ALTER TABLE templates ADD COLUMN IF NOT EXISTS zones_front JSONB;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS zones_back JSONB;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS suggested_layout_front JSONB;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS suggested_layout_back JSONB;

INSERT INTO portal_settings (key, value) VALUES
  ('card_field_sides', '{"photo":"front","full_name":"front","student_id":"front","position":"front","year_level":"front","signature":"front","qr":"both","blood_type":"back","emergency_contact_phone":"back","issue_date":"back","valid_until":"back"}')
ON CONFLICT (key) DO NOTHING;
