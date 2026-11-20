-- Fix: validate_api_key() could not resolve digest() from pgcrypto.
--
-- pgcrypto is installed in the `extensions` schema on Supabase. The
-- 20250903_harden_api_key_security migration recreated validate_api_key with
-- `SET search_path = public, private`, dropping `extensions`, so every call
-- failed with: function digest(text, unknown) does not exist
-- (SQLSTATE 42883) and all API-key authentication returned "Invalid API key".
--
-- Only the function's search_path is changed; the body and grants are untouched.
ALTER FUNCTION public.validate_api_key(text)
  SET search_path = public, private, extensions;
