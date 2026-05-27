-- Database indexes for query performance

-- students: most heavily queried table
CREATE INDEX IF NOT EXISTS idx_students_student_id ON students(student_id);
CREATE INDEX IF NOT EXISTS idx_students_created_at ON students(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_students_year_level ON students(year_level);
CREATE INDEX IF NOT EXISTS idx_students_qr_url ON students(qr_url) WHERE qr_url IS NULL;

-- student_submissions: used in duplicate checks, listing, export
CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON student_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON student_submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON student_submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_year_level_full_name ON student_submissions(year_level, full_name);

-- admins: used in role checks and listing
CREATE INDEX IF NOT EXISTS idx_admins_role ON admins(role);
CREATE INDEX IF NOT EXISTS idx_admins_created_at ON admins(created_at);

-- templates: used in active template lookup
CREATE INDEX IF NOT EXISTS idx_templates_is_active ON templates(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_templates_uploaded_at ON templates(uploaded_at DESC);

-- portal_settings: all lookups filter by key
CREATE INDEX IF NOT EXISTS idx_portal_settings_key ON portal_settings(key);

-- confirmations: filtered by student_id, ordered by date
CREATE INDEX IF NOT EXISTS idx_confirmations_student_id ON confirmations(student_id);
CREATE INDEX IF NOT EXISTS idx_confirmations_confirmed_at ON confirmations(confirmed_at DESC);
