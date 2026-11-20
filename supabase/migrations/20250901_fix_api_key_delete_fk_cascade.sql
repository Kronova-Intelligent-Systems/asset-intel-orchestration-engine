-- Fix: deleting an API key fails with a foreign-key violation.
--
-- Root cause: the private.api_keys row is referenced by foreign keys from
-- public tables that were created WITHOUT an ON DELETE rule:
--   * public.api_key_audit_log.api_key_id  (NOT NULL)
--   * public.voice_execution_logs.api_key_id (nullable)
--
-- Because delete_api_key() runs as SECURITY DEFINER it already bypasses RLS,
-- so a DELETE RLS policy does NOT help here. The delete is rejected by the
-- FK constraints themselves whenever a key has ever been logged.
--
-- This migration re-points those constraints so a key delete cascades to its
-- audit rows and detaches (nulls) its voice execution rows, preserving history.

-- 1) api_key_audit_log.api_key_id -> ON DELETE CASCADE
DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT con.conname
  INTO fk_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  JOIN pg_attribute att
    ON att.attrelid = con.conrelid
   AND att.attnum = ANY (con.conkey)
  WHERE con.contype = 'f'
    AND nsp.nspname = 'public'
    AND rel.relname = 'api_key_audit_log'
    AND att.attname = 'api_key_id';

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.api_key_audit_log DROP CONSTRAINT %I', fk_name);
  END IF;

  ALTER TABLE public.api_key_audit_log
    ADD CONSTRAINT api_key_audit_log_api_key_id_fkey
    FOREIGN KEY (api_key_id)
    REFERENCES private.api_keys (id)
    ON DELETE CASCADE;
END $$;

-- 2) voice_execution_logs.api_key_id -> ON DELETE SET NULL
DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT con.conname
  INTO fk_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  JOIN pg_attribute att
    ON att.attrelid = con.conrelid
   AND att.attnum = ANY (con.conkey)
  WHERE con.contype = 'f'
    AND nsp.nspname = 'public'
    AND rel.relname = 'voice_execution_logs'
    AND att.attname = 'api_key_id';

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.voice_execution_logs DROP CONSTRAINT %I', fk_name);
  END IF;

  ALTER TABLE public.voice_execution_logs
    ADD CONSTRAINT voice_execution_logs_api_key_id_fkey
    FOREIGN KEY (api_key_id)
    REFERENCES private.api_keys (id)
    ON DELETE SET NULL;
END $$;
