-- Add zone detection and suggested layout columns to templates table
ALTER TABLE templates ADD COLUMN IF NOT EXISTS zones_front JSONB;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS zones_back JSONB;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS suggested_layout_front JSONB;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS suggested_layout_back JSONB;

-- Add field-side mapping setting to portal_settings
INSERT INTO portal_settings (key, value) VALUES 
  ('card_field_sides', '{"photo":"front","full_name":"front","student_id":"front","position":"front","year_level":"front","signature":"front","qr":"both","blood_type":"back","emergency_contact_phone":"back","issue_date":"back","valid_until":"back"}')
ON CONFLICT (key) DO NOTHING;