-- =============================================================================
-- LMSA ID Portal — Migration 003: Add QR code fields
-- Adds date_of_birth, nationality, county_of_origin, current_address
-- to both students and student_submissions tables.
-- Safe to run on existing data (all columns nullable).
-- =============================================================================

ALTER TABLE students ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS nationality TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS county_of_origin TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS current_address TEXT;

ALTER TABLE student_submissions ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE student_submissions ADD COLUMN IF NOT EXISTS nationality TEXT;
ALTER TABLE student_submissions ADD COLUMN IF NOT EXISTS county_of_origin TEXT;
ALTER TABLE student_submissions ADD COLUMN IF NOT EXISTS current_address TEXT;

-- Seed default QR field settings if not already present
INSERT INTO portal_settings (key, value) VALUES
  ('qr_fields', '{"programme":{"label":"Programme","enabled":true},"blood_type":{"label":"Blood Type","enabled":true},"student_email":{"label":"Student Email","enabled":false},"emergency_contact_name":{"label":"Emergency Contact Name","enabled":true},"emergency_contact_phone":{"label":"Emergency Contact Phone","enabled":true},"date_of_birth":{"label":"Date of Birth","enabled":true},"nationality":{"label":"Nationality","enabled":true},"county_of_origin":{"label":"County of Origin","enabled":true},"current_address":{"label":"Current Address","enabled":true}}'::jsonb)
ON CONFLICT (key) DO NOTHING;
