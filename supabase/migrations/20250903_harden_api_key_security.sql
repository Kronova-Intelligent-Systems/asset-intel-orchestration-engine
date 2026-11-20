-- Harden API key / service-account key security.
--
-- Fixes three issues found in a security audit:
--
-- 1. validate_api_key() set RLS context with set_config(..., false), which is
--    SESSION-scoped. Supabase pools connections (PgBouncer/Supavisor,
--    typically transaction mode), so a session-scoped GUC can survive past
--    the current request and leak one caller's identity/scopes into a later,
--    unrelated request that reuses the same physical connection. Switching
--    the `is_local` argument to `true` makes these settings transaction-local
--    so they are automatically cleared at the end of every request.
--
-- 2. Scope updates had no auditable, ownership-checked RPC (app code was
--    falling back to a direct `.from("api_keys").update(...)` against a
--    table name that no longer exists in the public schema). This adds
--    private.update_api_key_scopes(), mirroring the ownership-check pattern
--    used elsewhere for this table.
--
-- 3. private.api_keys had no explicit REVOKE, and `authenticated` had
--    schema-level USAGE on `private`. SECURITY DEFINER functions run with
--    the *owner's* privileges, not the caller's, so callers never need
--    direct table or schema access -- only EXECUTE on the RPCs. Revoking
--    default/broad access removes unnecessary blast radius if a future
--    policy or grant mistake is made on that table.

-- 1. Transaction-local RLS context in validate_api_key.
CREATE OR REPLACE FUNCTION public.validate_api_key(api_key text)
RETURNS TABLE (
  user_id uuid,
  api_key_id uuid,
  scopes jsonb,
  valid boolean
)
SECURITY DEFINER
SET search_path = public, private, extensions
LANGUAGE plpgsql
AS $$
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

  IF key_record IS NOT NULL THEN
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
$$;

GRANT EXECUTE ON FUNCTION public.validate_api_key(text) TO authenticated, anon;

-- Argument list is required here: this database has more than one
-- validate_api_key overload (e.g. a legacy (p_key_hash, p_key_prefix)
-- variant), so the bare function name is ambiguous to COMMENT ON FUNCTION.
COMMENT ON FUNCTION public.validate_api_key(text) IS
'Validates an API key and sets transaction-local RLS context (request.jwt.claim.*). Transaction-local (set_config third arg = true) prevents claims from leaking across requests on pooled connections.';

-- 2. Ownership-checked RPC for scope updates, replacing ad-hoc table writes.
CREATE OR REPLACE FUNCTION private.update_api_key_scopes(p_key_id uuid, p_scopes jsonb)
RETURNS boolean
SECURITY DEFINER
SET search_path = private
LANGUAGE plpgsql
AS $$
DECLARE
  updated_id uuid;
BEGIN
  UPDATE private.api_keys
  SET scopes = p_scopes,
      updated_at = now()
  WHERE id = p_key_id
    AND user_id = auth.uid()
  RETURNING id INTO updated_id;

  RETURN updated_id IS NOT NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION private.update_api_key_scopes(uuid, jsonb) TO authenticated;

COMMENT ON FUNCTION private.update_api_key_scopes(uuid, jsonb) IS
'Updates the scopes for an API key owned by the calling user (auth.uid()). Ownership-checked, auditable RPC boundary -- callers must never write private.api_keys directly.';

-- 3. Lock down direct access to the private schema and its table. Every
-- legitimate access path is a SECURITY DEFINER function, which runs with the
-- function owner's privileges regardless of caller grants.
REVOKE ALL ON private.api_keys FROM authenticated, anon, public;
REVOKE USAGE ON SCHEMA private FROM authenticated, anon, public;

-- service_role and postgres (migrations/admin tooling) keep full access.
GRANT USAGE ON SCHEMA private TO postgres, service_role;
GRANT ALL ON private.api_keys TO postgres, service_role;
