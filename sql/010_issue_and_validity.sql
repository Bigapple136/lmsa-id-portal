-- =============================================================================
-- LMSA ID Portal — Add card issue date + validity (010)
-- Run this to support ISSUED / VALID THROUGH fields on the card back
-- =============================================================================

-- Add issue date + validity columns to students table
ALTER TABLE students ADD COLUMN IF NOT EXISTS issue_date DATE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS valid_until DATE;

-- Backfill issue_date for already-confirmed students:
-- use the earliest 'confirmed' confirmation, falling back to record creation
UPDATE students s
SET issue_date = COALESCE(
  (SELECT MIN(c.confirmed_at)::date
     FROM confirmations c
    WHERE c.student_id = s.student_id AND c.action = 'confirmed'),
  s.created_at::date
)
WHERE s.issue_date IS NULL AND s.status = 'confirmed';

-- valid_until has no historical source; set it via the admin renewal flow
-- (PUT /api/students/renew-cohort)
