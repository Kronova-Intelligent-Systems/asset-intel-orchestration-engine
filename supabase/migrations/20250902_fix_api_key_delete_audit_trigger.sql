-- Fix: deleting an API key still fails after the FK-cascade migration, with:
--   "insert or update on table "api_key_audit_log" violates foreign key
--    constraint "api_key_audit_log_api_key_id_fkey" ...
--    Key (api_key_id)=(...) is not present in table "api_keys"."
--
-- Root cause: private.api_keys has a combined AFTER INSERT OR UPDATE OR DELETE
-- trigger (audit_api_key_changes -> private.log_api_key_audit()). On DELETE it
-- runs AFTER the row is already removed from private.api_keys, then tries to
-- INSERT a new api_key_audit_log row referencing OLD.id ('deleted' action).
-- That INSERT's own foreign key check fails because the parent key row no
-- longer exists by the time an AFTER DELETE trigger runs. This is a trigger
-- design bug, not something the previous FK/RLS migration could fix.
--
-- Fix: split the trigger. INSERT/UPDATE logging stays AFTER (the row exists
-- by then). DELETE logging moves to a BEFORE DELETE trigger, so the audit
-- insert happens while OLD.id is still present in private.api_keys. We also
-- switch api_key_audit_log.api_key_id's FK from ON DELETE CASCADE to
-- ON DELETE SET NULL (and make the column nullable) so the full audit
-- history -- including the "deleted" entry we just inserted -- survives the
-- actual deletion instead of being cascade-removed immediately after.

-- 1) Allow api_key_id to be null so SET NULL can apply to historical rows.
ALTER TABLE public.api_key_audit_log ALTER COLUMN api_key_id DROP NOT NULL;

-- 2) Re-point the FK from CASCADE to SET NULL.
ALTER TABLE public.api_key_audit_log
  DROP CONSTRAINT IF EXISTS api_key_audit_log_api_key_id_fkey;

ALTER TABLE public.api_key_audit_log
  ADD CONSTRAINT api_key_audit_log_api_key_id_fkey
  FOREIGN KEY (api_key_id)
  REFERENCES private.api_keys (id)
  ON DELETE SET NULL;

-- 3) Drop the old combined trigger.
DROP TRIGGER IF EXISTS audit_api_key_changes ON private.api_keys;

-- 4) INSERT/UPDATE logging: unchanged behavior, still AFTER (row exists).
CREATE OR REPLACE FUNCTION private.log_api_key_audit_write()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.api_key_audit_log (api_key_id, user_id, action, metadata)
    VALUES (NEW.id, NEW.user_id, 'created', jsonb_build_object('name', NEW.name, 'expires_at', NEW.expires_at));
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.is_active = false AND OLD.is_active = true THEN
      INSERT INTO public.api_key_audit_log (api_key_id, user_id, action)
      VALUES (NEW.id, NEW.user_id, 'revoked');
    ELSIF NEW.key_hash != OLD.key_hash THEN
      INSERT INTO public.api_key_audit_log (api_key_id, user_id, action)
      VALUES (NEW.id, NEW.user_id, 'rotated');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_api_key_insert_update
  AFTER INSERT OR UPDATE ON private.api_keys
  FOR EACH ROW
  EXECUTE FUNCTION private.log_api_key_audit_write();

-- 5) DELETE logging: moved to BEFORE DELETE so OLD.id still satisfies the
--    audit log's foreign key at insert time.
CREATE OR REPLACE FUNCTION private.log_api_key_audit_delete()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.api_key_audit_log (api_key_id, user_id, action)
  VALUES (OLD.id, OLD.user_id, 'deleted');
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_api_key_delete
  BEFORE DELETE ON private.api_keys
  FOR EACH ROW
  EXECUTE FUNCTION private.log_api_key_audit_delete();

-- 6) The old public-schema function is no longer used by any trigger; drop it
--    to avoid confusion with the two new private-schema functions above.
DROP FUNCTION IF EXISTS private.log_api_key_audit() CASCADE;
