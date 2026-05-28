-- =============================================================================
-- LMSA ID Portal — Core Schema (001)
-- Run this once to recreate the full database from scratch.
-- Idempotent: all statements use IF NOT EXISTS / OR REPLACE.
-- =============================================================================

-- 1. students ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
  student_id        TEXT PRIMARY KEY,
  full_name         TEXT NOT NULL,
  year_level        TEXT NOT NULL CHECK (year_level IN (
                      '1st Year','2nd Year','3rd Year',
                      '4th Year','5th Year','6th Year'
                    )),
  position          TEXT,
  photo_url         TEXT,
  signature_url     TEXT,
  blood_type        TEXT CHECK (blood_type IN (
                      'A+','A-','B+','B-','AB+','AB-','O+','O-'
                    )),
  programme         TEXT,
  student_email     TEXT,
  emergency_contact_name  TEXT,
  emergency_contact_phone TEXT,
  qr_url            TEXT,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
                      'pending','confirmed','issue','photo_issue'
                    )),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. admins ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admins (
  id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email             TEXT NOT NULL,
  name              TEXT,
  role              TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'support_admin')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. admin_role_logs ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_role_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id          UUID REFERENCES admins(id) ON DELETE CASCADE,
  action            TEXT NOT NULL CHECK (action IN ('invited', 'role_changed', 'removed')),
  old_role          TEXT,
  new_role          TEXT,
  performed_by      UUID REFERENCES admins(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION log_admin_action(
  p_admin_id UUID, p_action TEXT,
  p_old_role TEXT, p_new_role TEXT,
  p_performed_by UUID
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO admin_role_logs (admin_id, action, old_role, new_role, performed_by)
  VALUES (p_admin_id, p_action, p_old_role, p_new_role, p_performed_by);
END;
$$;

-- 4. portal_settings ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal_settings (
  key               TEXT PRIMARY KEY,
  value             JSONB NOT NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default settings
INSERT INTO portal_settings (key, value) VALUES
  ('card_fields', '{"full_name":{"enabled":true},"student_id":{"enabled":true},"year_level":{"enabled":true},"position":{"enabled":false},"photo":{"enabled":true},"signature":{"enabled":true}}'::jsonb),
  ('qr_fields', '{"programme":{"label":"Programme","enabled":true},"blood_type":{"label":"Blood Type","enabled":true},"student_email":{"label":"Student Email","enabled":false},"emergency_contact_name":{"label":"Emergency Contact Name","enabled":true},"emergency_contact_phone":{"label":"Emergency Contact Phone","enabled":true}}'::jsonb),
  ('card_layout', '{"primaryColor":"#1A365D","secondaryColor":"#E2E8F0","fontFamily":"Inter","logoPosition":"top-left"}'::jsonb),
  ('submission_form', '{"enabled":false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 5. templates ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS templates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name         TEXT NOT NULL,
  file_url          TEXT NOT NULL,
  is_active         BOOLEAN NOT NULL DEFAULT false,
  uploaded_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. confirmations -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS confirmations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        TEXT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  action            TEXT NOT NULL CHECK (action IN ('confirmed', 'issue', 'photo_issue', 'self_corrected')),
  note              TEXT,
  confirmed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. student_submissions -----------------------------------------------------
CREATE TABLE IF NOT EXISTS student_submissions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id              TEXT NOT NULL,
  full_name               TEXT NOT NULL,
  year_level              TEXT NOT NULL CHECK (year_level IN (
                            '1st Year','2nd Year','3rd Year',
                            '4th Year','5th Year','6th Year'
                          )),
  position                TEXT,
  programme               TEXT,
  blood_type              TEXT CHECK (blood_type IN (
                            'A+','A-','B+','B-','AB+','AB-','O+','O-'
                          )),
  student_email           TEXT,
  emergency_contact_name  TEXT,
  emergency_contact_phone TEXT,
  status                  TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
                            'pending','approved','rejected'
                          )),
  admin_notes             TEXT,
  reviewed_by             UUID REFERENCES admins(id),
  reviewed_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- students
CREATE INDEX IF NOT EXISTS idx_students_student_id ON students(student_id);
CREATE INDEX IF NOT EXISTS idx_students_created_at ON students(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_students_year_level ON students(year_level);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
CREATE INDEX IF NOT EXISTS idx_students_qr_url_null ON students(qr_url) WHERE qr_url IS NULL;

-- admins
CREATE INDEX IF NOT EXISTS idx_admins_role ON admins(role);
CREATE INDEX IF NOT EXISTS idx_admins_created_at ON admins(created_at);

-- admin_role_logs
CREATE INDEX IF NOT EXISTS idx_admin_role_logs_admin_id ON admin_role_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_role_logs_created_at ON admin_role_logs(created_at DESC);

-- portal_settings
CREATE INDEX IF NOT EXISTS idx_portal_settings_key ON portal_settings(key);

-- templates
CREATE INDEX IF NOT EXISTS idx_templates_is_active ON templates(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_templates_uploaded_at ON templates(uploaded_at DESC);

-- confirmations
CREATE INDEX IF NOT EXISTS idx_confirmations_student_id ON confirmations(student_id);
CREATE INDEX IF NOT EXISTS idx_confirmations_confirmed_at ON confirmations(confirmed_at DESC);

-- student_submissions
CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON student_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON student_submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON student_submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_year_level_full_name ON student_submissions(year_level, full_name);

-- =============================================================================
-- TRIGGER: auto-update updated_at
-- =============================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_students_updated_at') THEN
    CREATE TRIGGER trg_students_updated_at BEFORE UPDATE ON students
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_submissions_updated_at') THEN
    CREATE TRIGGER trg_submissions_updated_at BEFORE UPDATE ON student_submissions
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END;
$$;
