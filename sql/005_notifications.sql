-- =============================================================================
-- LMSA ID Portal — Notifications (005)
-- Persistent notification log for admin event feed + Realtime push.
-- Idempotent: safe to re-run.
-- =============================================================================

-- 1. notifications table -----------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL CHECK (type IN ('submission','self_correction','photo_issue')),
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  student_id  TEXT,
  is_read     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(is_read) WHERE is_read = false;

-- Row-level security (RLS)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if present, then recreate (idempotent)
DROP POLICY IF EXISTS "Authenticated read" ON notifications;
CREATE POLICY "Authenticated read" ON notifications
  FOR SELECT USING (auth.role() = 'authenticated');

-- 2. Enable Realtime on notifications ----------------------------------------
-- Idempotent: check if table is already in publication before adding
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END $$;