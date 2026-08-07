-- =============================================================================
-- LMSA ID Portal — Add students.confirmed_at (011)
-- The backend writes/reads `students.confirmed_at` (confirmations.js:41,76 and
-- students.js:198,218) but the column was missing from every schema file, so
-- fresh rebuilds broke the confirm flow and /api/students/status. Add it here
-- idempotently; safe to run on prod (IF NOT EXISTS) and on dev rebuilds.
-- =============================================================================

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

-- Backfill confirmed_at for already-confirmed students from the earliest
-- 'confirmed' confirmation row, falling back to record creation time.
UPDATE students s
SET confirmed_at = COALESCE(
  (SELECT MIN(c.confirmed_at)
     FROM confirmations c
    WHERE c.student_id = s.student_id AND c.action = 'confirmed'),
  s.created_at
)
WHERE s.confirmed_at IS NULL AND s.status = 'confirmed';
