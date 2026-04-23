-- Support Admin Feature - Run this in Supabase SQL Editor

-- 1. Add role column to admins table (default to 'admin' for existing admins)
ALTER TABLE admins ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'admin';

-- 2. Create admin_role_logs table
CREATE TABLE IF NOT EXISTS admin_role_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admins(id) ON DELETE CASCADE,
  action TEXT NOT NULL,           -- 'invited', 'role_changed', 'removed'
  old_role TEXT,
  new_role TEXT,
  performed_by UUID REFERENCES admins(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Enable Row Level Security (optional but recommended)
ALTER TABLE admin_role_logs ENABLE ROW LEVEL SECURITY;

-- 4. Create indexes for audit log queries
CREATE INDEX IF NOT EXISTS idx_admin_role_logs_admin_id ON admin_role_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_role_logs_created_at ON admin_role_logs(created_at DESC);

-- 5. Create function to log admin actions
CREATE OR REPLACE FUNCTION log_admin_action(
  p_admin_id UUID,
  p_action TEXT,
  p_old_role TEXT,
  p_new_role TEXT,
  p_performed_by UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO admin_role_logs (admin_id, action, old_role, new_role, performed_by)
  VALUES (p_admin_id, p_action, p_old_role, p_new_role, p_performed_by);
END;
$$;