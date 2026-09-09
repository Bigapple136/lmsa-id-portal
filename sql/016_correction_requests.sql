-- =============================================================================
-- LMSA ID Portal — Gated correction requests (016)
--
-- Students used to write their own record directly through
-- PATCH /api/students/:id/self-correct: a signed preview link was enough to
-- move a student into another year level, change their programme, or rewrite an
-- emergency contact, with an admin notified only afterwards. The preview token
-- proves who the student is; it does not authorise them to edit the enrollment
-- record. This makes the request the unit of work and puts an admin in between.
--
-- correction_requests is the queue: what the student asked for (as a field list
-- with the value they saw and the value they want), their own words, and the
-- review outcome. Nothing lands on `students` until an admin approves.
--
-- One open request per student: a student who reports again while a request is
-- pending replaces it (they are editing their ask, not filing a second one), and
-- the partial unique index is what makes that guarantee true under concurrent
-- submits rather than just likely.
--
-- RLS: enabled with no policies, service-role only — the same posture as
-- admin_actions/layout_history (see sql/013 for why that is safe here).
--
-- Run this in the Supabase SQL Editor after sql/015_correction_details.sql.
-- Idempotent: safe to re-run.
-- =============================================================================

CREATE TABLE IF NOT EXISTS correction_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    TEXT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
                  'pending','approved','rejected','withdrawn'
                )),
  -- [{ key, label, from, to }] as computed at request time. `from` is what the
  -- student saw and is the value approval compares against, so a change an admin
  -- made in the meantime cannot be silently overwritten.
  fields        JSONB NOT NULL DEFAULT '[]'::jsonb,
  student_note  TEXT,
  admin_note    TEXT,
  reviewed_by   UUID REFERENCES admins(id) ON DELETE SET NULL,
  reviewed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS correction_requests_one_open_per_student
  ON correction_requests (student_id) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_correction_requests_created_at
  ON correction_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_correction_requests_student
  ON correction_requests(student_id, created_at DESC);

ALTER TABLE correction_requests ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_correction_requests_updated_at BEFORE UPDATE ON correction_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- The activity log (confirmations) grows a vocabulary for the new states: the
-- student asking, and the admin applying it. `self_corrected` keeps its exact
-- meaning — the record did change — it is now written on approval instead of on
-- submit, which is what routes/analytics.js counts for its per-field stats.
-- 'correction_requested' is the student's ask, which is a different event and
-- must not be counted as a correction that happened.
ALTER TABLE confirmations DROP CONSTRAINT IF EXISTS confirmations_action_check;
ALTER TABLE confirmations ADD CONSTRAINT confirmations_action_check CHECK (
  action IN ('confirmed','issue','photo_issue','self_corrected','correction_requested')
);
