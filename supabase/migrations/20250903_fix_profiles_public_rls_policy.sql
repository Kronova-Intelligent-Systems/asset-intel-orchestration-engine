-- Security fix for GHSA-8h52-3cfj-cmrw:
-- public.profiles has RLS enabled, but multiple permissive SELECT policies
-- with USING (true) grant unrestricted anonymous read access to every row
-- (email, full_name, username, waddress, etc.), regardless of whether the
-- owner opted into public sharing via the public_access column.
--
-- Postgres RLS policies are OR'd together, so ALL such policies must be
-- fixed -- leaving even one with USING (true) reopens the hole.
--
-- Two offending policies were found:
--   1. "Allow public access to profiles" (tracked in migration history,
--      regressed by 20240327_add_profile_public_id.sql)
--   2. "Public profiles are viewable by everyone." (found live in the
--      Supabase dashboard; not present in any tracked migration, so it
--      was created directly against the database outside version control)

DROP POLICY IF EXISTS "Allow public access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;

CREATE POLICY "Allow public access to profiles"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (public_access = true);

COMMENT ON POLICY "Allow public access to profiles" ON public.profiles IS
'Restricts anonymous/authenticated SELECT to rows the owner has explicitly opted into public sharing (public_access = true). Do not change back to USING (true) -- see GHSA-8h52-3cfj-cmrw. If another permissive SELECT policy is added to this table, it must carry the same predicate or it will silently reopen this issue (RLS policies are OR''d).';
