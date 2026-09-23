-- Restrict the "Allow public access to profiles" policy to opted-in rows.
--
-- GHSA-8h52-3cfj-cmrw: 20240327_add_profile_public_id.sql created this policy
-- with USING (true) for the anon and authenticated roles. Its own comment says
-- "allow public access to profiles by public_id", so the intent was scoped --
-- the predicate was not. The sibling policy in 20240321_fix_public_cards.sql
-- already uses the intended form, USING (public_access = true).
--
-- Effect of the unscoped predicate: any holder of the publishable anon key can
-- read every row of public.profiles, including email, full_name, company,
-- waddress and xhandle, for every user regardless of their sharing choice.
--
-- This migration replaces the predicate. It does not drop the policy, so
-- existing public business-card links that rely on public_access = true keep
-- working.

DROP POLICY IF EXISTS "Allow public access to profiles" ON public.profiles;

CREATE POLICY "Allow public access to profiles"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (public_access = true);
