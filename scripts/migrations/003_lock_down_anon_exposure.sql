-- 003_lock_down_anon_exposure.sql
-- Fixes broken access control reported against public.profiles and the same class
-- of exposure found in an audit of the whole public schema.
-- Idempotent: safe to run more than once.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. profiles: remove the row-wide public SELECT policy.
--    Every profile has public_access = true, so this policy exposed every column
--    (stripe_customer_id, waddress, email, role, ...) to anon AND to any logged-in
--    user. The base table becomes owner-only; public reads go through the view.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles; -- duplicate of "Users can insert own profile"

REVOKE ALL ON public.profiles FROM anon;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.profiles FROM authenticated;

-- The column-limited view must run as its owner so it can read rows the caller
-- cannot. Safety comes from the fixed column list and the public_access filter.
CREATE OR REPLACE VIEW public.public_profile_cards AS
  SELECT
    p.public_id,
    p.full_name,
    p.company,
    p.job_title,
    p.email,
    p.website,
    p.linkedin_url,
    p.avatar_url,
    p.company_logo_url,
    p.xhandle,
    p.card_style
  FROM public.profiles p
  WHERE p.public_access = true;
ALTER VIEW public.public_profile_cards SET (security_invoker = false);
REVOKE ALL ON public.public_profile_cards FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.public_profile_cards TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. profiles: stop users escalating their own privileges.
--    "Users can update own profile" allowed UPDATE of every column, so a user
--    could set role = 'admin'. Only the service role may change these fields.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'profiles.role can only be changed by the service role' USING ERRCODE = '42501';
    END IF;
    IF NEW.email_verified IS DISTINCT FROM OLD.email_verified
       OR NEW.email_verified_at IS DISTINCT FROM OLD.email_verified_at THEN
      RAISE EXCEPTION 'email verification state can only be changed by the service role' USING ERRCODE = '42501';
    END IF;
    IF NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id AND OLD.stripe_customer_id IS NOT NULL THEN
      RAISE EXCEPTION 'stripe_customer_id cannot be changed once set' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_sensitive_columns ON public.profiles;
CREATE TRIGGER protect_profile_sensitive_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_sensitive_columns();

-- ---------------------------------------------------------------------------
-- 3. Tables with RLS disabled and full anon grants.
-- ---------------------------------------------------------------------------
ALTER TABLE public.api_routes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.api_routes FROM anon, authenticated;       -- read via get_api_routes() / service role

ALTER TABLE public._sqlx_migrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public._sqlx_migrations FROM anon, authenticated;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.messages FROM anon;
DROP POLICY IF EXISTS "messages_owner_all" ON public.messages;
CREATE POLICY "messages_owner_all" ON public.messages
  FOR ALL TO authenticated
  USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());

-- reusable_packages has no owner column and the app reads it with the logged-in
-- client, so keep authenticated access but remove anon. Tenant scoping needs a
-- follow-up schema change (add user_id).
ALTER TABLE public.reusable_packages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reusable_packages FROM anon;
DROP POLICY IF EXISTS "reusable_packages_authenticated_all" ON public.reusable_packages;
CREATE POLICY "reusable_packages_authenticated_all" ON public.reusable_packages
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 4. Views owned by postgres bypass RLS. anon could read other tenants' rows
--    (asset_analytics 15, latest_asset_sensor_readings 20, unified_workflows 17).
--    Make them honour the caller's RLS and remove anon access.
-- ---------------------------------------------------------------------------
DO $$
DECLARE v text;
BEGIN
  FOREACH v IN ARRAY ARRAY[
    'asset_analytics','asset_intelligence_learning_stats','embedding_job_stats',
    'iot_sensor_analytics','latest_asset_sensor_readings','package_shipment_details',
    'package_utilization','packaging_order_analytics','shipping_analytics',
    'unified_workflows','user_oauth_clients'
  ] LOOP
    EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', v);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon', v);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated, service_role', v);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Over-broad public read policies on PII.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Inqueries readable by everyone" ON public.inqueries;

-- ---------------------------------------------------------------------------
-- 6. SECURITY DEFINER functions: anon could execute all of them, and several take
--    a caller-supplied user id with no auth.uid() check (IDOR).
--    a) remove anon/PUBLIC execute everywhere, except functions that RLS policies
--       call and validate_api_key (API-key callers have no session).
--    b) functions that take a user id and do no auth check become service-role only.
-- ---------------------------------------------------------------------------
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
      AND p.proname <> 'validate_api_key'
      AND NOT EXISTS (
        SELECT 1 FROM pg_policies pol
        WHERE pol.schemaname = 'public'
          AND (coalesce(pol.qual, '') || coalesce(pol.with_check, '')) ILIKE '%' || p.proname || '(%')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f.sig);
  END LOOP;

  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
      AND p.proname IN (
        'create_agent','create_workflow','delete_agent','delete_workflow',
        'update_agent','update_workflow','get_agent_execution_history',
        'get_workflow_execution_history','get_ai_request_volume',
        'get_refrigerated_shipment_stats','increment_ai_tokens_used',
        'increment_workflow_execution','log_agent_execution','log_workflow_execution',
        'log_email_send','search_shipments_by_iot_data','cleanup_expired_oauth_tokens',
        'reset_monthly_usage','reset_monthly_ai_token_usage','handle_new_user')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 7. TRUNCATE ignores RLS. Neither client role should ever hold it.
-- ---------------------------------------------------------------------------
REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- Future tables should not be granted to anon automatically.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;

COMMIT;

NOTIFY pgrst, 'reload schema';
