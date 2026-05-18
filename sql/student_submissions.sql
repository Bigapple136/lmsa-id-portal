-- Student submissions table for self-service data collection form
CREATE TABLE IF NOT EXISTS student_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  year_level TEXT NOT NULL,
  position TEXT,
  programme TEXT,
  blood_type TEXT,
  student_email TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES admins(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add submission_form toggle to portal_settings
INSERT INTO portal_settings (key, value, updated_at)
VALUES ('submission_form', '{"enabled": false}', now())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;
