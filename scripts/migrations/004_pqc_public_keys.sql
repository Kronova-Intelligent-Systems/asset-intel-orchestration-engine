-- ============================================================================
-- KRONOVA POST-QUANTUM PUBLIC KEY REGISTRY
-- Public keys (ML-DSA-65) that a user registers so Kronova can verify signed
-- A2A and AetherNet messages. Only public keys are stored, never private keys.
-- Additive only: one table, one index, owner-only RLS, no anon access.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.pqc_public_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_id TEXT NOT NULL CHECK (key_id ~ '^pqc_[0-9a-f]{16}$'),
  algorithm TEXT NOT NULL DEFAULT 'ML-DSA-65' CHECK (algorithm = 'ML-DSA-65'),
  -- 1952-byte ML-DSA-65 public key, base64 encoded
  public_key TEXT NOT NULL CHECK (char_length(public_key) = 2604),
  label TEXT CHECK (label IS NULL OR char_length(label) <= 120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  UNIQUE (user_id, key_id)
);

CREATE INDEX IF NOT EXISTS idx_pqc_public_keys_active
  ON public.pqc_public_keys (user_id)
  WHERE revoked_at IS NULL;

ALTER TABLE public.pqc_public_keys ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pqc_public_keys' AND policyname = 'pqc_public_keys_owner') THEN
    CREATE POLICY pqc_public_keys_owner ON public.pqc_public_keys
      FOR ALL TO authenticated
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

REVOKE ALL ON public.pqc_public_keys FROM anon;
