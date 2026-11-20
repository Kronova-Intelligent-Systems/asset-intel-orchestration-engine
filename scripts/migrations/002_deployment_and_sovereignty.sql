-- ============================================================================
-- KRONOVA DEPLOYMENT TARGETS, DEPLOYMENT JOBS AND DATA STORE INVENTORY
-- Backs the on_premise_ai_deployment and data_sovereignty_manager skills.
-- Additive only: creates three tables, indexes and owner-only RLS policies.
-- ============================================================================

-- 1. Customer-side deployment targets. A runner authenticates with a token whose
--    sha256 hash is stored here; the token itself is shown once at registration.
CREATE TABLE IF NOT EXISTS public.deployment_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  target_type TEXT NOT NULL CHECK (target_type IN ('private_cloud', 'on_premise_server', 'edge_device')),
  security_profile TEXT NOT NULL DEFAULT 'standard' CHECK (security_profile IN ('standard', 'high_security', 'air_gapped')),
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'online', 'offline', 'revoked')),
  runner_version TEXT,
  capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_deployment_targets_user ON public.deployment_targets (user_id);

-- 2. Deployment jobs queued for a target and executed by its runner.
CREATE TABLE IF NOT EXISTS public.deployment_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES public.deployment_targets(id) ON DELETE CASCADE,
  model_ids TEXT[] NOT NULL,
  security_profile TEXT NOT NULL CHECK (security_profile IN ('standard', 'high_security', 'air_gapped')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'claimed', 'running', 'succeeded', 'failed', 'cancelled')),
  manifest JSONB NOT NULL,
  result JSONB,
  error TEXT,
  claimed_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deployment_jobs_target_status ON public.deployment_jobs (target_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_deployment_jobs_user ON public.deployment_jobs (user_id, created_at DESC);

-- 3. Data store inventory: where each store of data physically lives.
CREATE TABLE IF NOT EXISTS public.data_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  store_type TEXT NOT NULL DEFAULT 'database' CHECK (store_type IN ('database', 'object_storage', 'file_share', 'saas', 'backup', 'analytics', 'other')),
  provider TEXT,
  region TEXT,
  jurisdiction TEXT NOT NULL CHECK (jurisdiction ~ '^[A-Z]{2}$'),
  data_classification TEXT NOT NULL CHECK (data_classification IN ('public', 'internal', 'confidential', 'restricted')),
  contains_personal_data BOOLEAN NOT NULL DEFAULT false,
  transfer_mechanism TEXT CHECK (transfer_mechanism IN ('adequacy', 'scc', 'bcr', 'consent', 'none')),
  last_verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_data_stores_user ON public.data_stores (user_id);

-- 4. Row-level security: owners only. Runners and API keys use the service role,
--    and every server query also filters on user_id.
ALTER TABLE public.deployment_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deployment_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_stores ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'deployment_targets' AND policyname = 'deployment_targets_owner') THEN
    CREATE POLICY deployment_targets_owner ON public.deployment_targets
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'deployment_jobs' AND policyname = 'deployment_jobs_owner') THEN
    CREATE POLICY deployment_jobs_owner ON public.deployment_jobs
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'data_stores' AND policyname = 'data_stores_owner') THEN
    CREATE POLICY data_stores_owner ON public.data_stores
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
