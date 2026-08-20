-- sql/013_enable_rls_core_tables.sql
-- Enables Row Level Security on the six core tables that had none.
-- This does NOT touch, read, or modify any existing row — it only
-- gates access through Supabase's public REST API going forward.
--
-- Safe for this app specifically because:
--   1. The backend connects with the SERVICE ROLE key (backend/db.js),
--      which always bypasses RLS regardless of policies. Every route
--      in this app goes through that one client.
--   2. The frontend's Supabase client (anon key) is only ever used for
--      supabase.auth.* (login/session) — never supabase.from(...) —
--      so it never touches these tables at all.
-- No policies are added, matching the existing convention in this repo
-- (see qr_audit, qr_keys, admin_actions, layout_history): enabling RLS
-- with zero policies denies anon/authenticated access by default while
-- leaving service-role access completely unaffected.
--
-- Rollback, if ever needed (instant, no data impact either way):
--   ALTER TABLE students ENABLE ROW LEVEL SECURITY -> DISABLE ROW LEVEL SECURITY
--   (repeat per table below)

ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_settings ENABLE ROW LEVEL SECURITY;
