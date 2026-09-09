-- =============================================================================
-- LMSA ID Portal — Migration 017: restore support (qr_audit sequence reset)
--
-- qr_audit.id is BIGSERIAL. Restoring its rows with explicit ids preserves
-- history but leaves the sequence behind MAX(id), so the next natural
-- insert can fail with a duplicate-key error. This SECURITY DEFINER
-- function lets the backend (service role) advance the sequence after a
-- restore via supabase.rpc('reset_qr_audit_sequence').
--
-- Idempotent: safe to re-run. If this migration was never applied, restore
-- still completes but reports a warning naming this file.
-- =============================================================================

CREATE OR REPLACE FUNCTION reset_qr_audit_sequence()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  max_id BIGINT;
BEGIN
  SELECT COALESCE(MAX(id), 0) INTO max_id FROM qr_audit;
  PERFORM setval('qr_audit_id_seq', GREATEST(max_id, 1));
  RETURN max_id;
END;
$$;

GRANT EXECUTE ON FUNCTION reset_qr_audit_sequence() TO service_role;
