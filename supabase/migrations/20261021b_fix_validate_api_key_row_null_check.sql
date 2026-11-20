-- Fix: validate_api_key() rejected every key that had never been used.
--
-- `key_record` is a composite row. In PL/pgSQL, `row IS NOT NULL` is only true
-- when EVERY column is non-null. A freshly created key has NULL last_used_at and
-- last_request_at, so the check was false and the function returned valid=false
-- for any key until it had been used once, which could never happen.
--
-- `IF FOUND` is the correct test for "the SELECT ... INTO returned a row".
-- Behaviour is otherwise identical; signature, grants and search_path are unchanged.
CREATE OR REPLACE FUNCTION public.validate_api_key(api_key text)
RETURNS TABLE(user_id uuid, api_key_id uuid, scopes jsonb, valid boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'extensions'
AS $function$
DECLARE
  key_record private.api_keys;
  key_hash_to_check text;
BEGIN
  key_hash_to_check := encode(digest(api_key, 'sha256'), 'hex');

  SELECT * INTO key_record
  FROM private.api_keys
  WHERE key_hash = key_hash_to_check
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;

  IF FOUND THEN
    -- `true` = transaction-local. Cleared automatically at COMMIT/ROLLBACK so
    -- these claims can never bleed into a later request on a pooled connection.
    PERFORM set_config('request.jwt.claim.sub', key_record.user_id::text, true);
    PERFORM set_config('request.jwt.claim.api_key_id', key_record.id::text, true);
    PERFORM set_config('request.jwt.claim.scopes', key_record.scopes::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

    UPDATE private.api_keys
    SET last_used_at = now(),
        total_requests = COALESCE(total_requests, 0) + 1,
        last_request_at = now()
    WHERE id = key_record.id;

    RETURN QUERY SELECT
      key_record.user_id,
      key_record.id,
      key_record.scopes,
      true;
  ELSE
    RETURN QUERY SELECT
      NULL::uuid,
      NULL::uuid,
      NULL::jsonb,
      false;
  END IF;
END;
$function$;
