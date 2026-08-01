-- sql/008_notification_reads.sql
-- Per-admin notification read tracking
-- Run this AFTER 005_notifications.sql

-- 1. notification_reads table ------------------------------------------------
-- Tracks which admin has read which notification. This allows:
--   * Per-admin unread counts (instead of global)
--   * "Mark as read" per notification (without affecting other admins)
--   * Each admin sees their own unread badge count
CREATE TABLE IF NOT EXISTS notification_reads (
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  admin_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_id, admin_id)
);

-- Index for fast "unread for this admin" queries
CREATE INDEX IF NOT EXISTS idx_notification_reads_admin ON notification_reads(admin_id);

-- 2. RLS: only the owning admin can read/write their own rows ----------------
ALTER TABLE notification_reads ENABLE ROW LEVEL SECURITY;

-- Admins can read their own reads
CREATE POLICY "Admin can read own reads" ON notification_reads
  FOR SELECT USING (auth.uid() = admin_id);

-- Admins can insert their own reads
CREATE POLICY "Admin can insert own reads" ON notification_reads
  FOR INSERT WITH CHECK (auth.uid() = admin_id);

-- 3. Helper view: notifications with per-admin read status -------------------
-- Returns all notifications with an extra `is_read_by_me` boolean for the
-- calling admin. Usage:
--   SELECT * FROM admin_notifications WHERE admin_id = auth.uid()
--   (or call via RPC if you prefer)
CREATE OR REPLACE VIEW admin_notifications AS
SELECT
  n.*,
  nr.admin_id IS NOT NULL AS is_read_by_me,
  nr.read_at
FROM notifications n
LEFT JOIN notification_reads nr
  ON n.id = nr.notification_id
  AND nr.admin_id = auth.uid()
ORDER BY n.created_at DESC;

-- Grant access to the view
GRANT SELECT ON admin_notifications TO authenticated;

-- 4. Enable Realtime on notification_reads -----------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE notification_reads;