-- ============================================================
-- Harden stablecoin mint/burn supply updates
--
-- Problem: application code previously read `total_supply`, computed a new
-- value in JS, then wrote it back in a separate UPDATE. Two concurrent
-- mint/burn calls on the same stablecoin can both read the same stale
-- value and one write silently overwrites the other (lost update), letting
-- recorded supply drift from what was actually minted/burned, and letting
-- concurrent mints each pass collateral checks against a stale supply
-- figure (over-mint beyond the configured collateral ratio).
--
-- Fix: perform the read-check-write as a single atomic UPDATE inside a
-- SECURITY DEFINER function, so Postgres's row lock serializes concurrent
-- callers and the ownership + non-negative-supply checks are enforced
-- inside the same statement that mutates the row.
-- ============================================================

-- Called by application code running as the authenticated owner (session
-- auth). Ownership is enforced via auth.uid(), mirroring the existing RLS
-- policy on private_stablecoins so this introduces no new authorization
-- surface versus what UPDATE already allowed.
CREATE OR REPLACE FUNCTION public.adjust_stablecoin_supply(
  p_stablecoin_id UUID,
  p_delta NUMERIC
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_supply NUMERIC;
BEGIN
  UPDATE private_stablecoins
  SET total_supply = (total_supply::numeric + p_delta)::text
  WHERE id = p_stablecoin_id
    AND user_id = auth.uid()
    AND (total_supply::numeric + p_delta) >= 0
  RETURNING total_supply::numeric INTO v_new_supply;

  IF v_new_supply IS NULL THEN
    RAISE EXCEPTION 'Unable to adjust supply: stablecoin not found, not owned by caller, or delta would make supply negative';
  END IF;

  RETURN v_new_supply::text;
END;
$$;

REVOKE ALL ON FUNCTION public.adjust_stablecoin_supply(UUID, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adjust_stablecoin_supply(UUID, NUMERIC) TO authenticated;

-- Called only by trusted server-side code holding the service_role key
-- (e.g. the stablecoin-operations Edge Function) that has ALREADY
-- independently verified the caller's identity from a Supabase-issued JWT
-- and wants to apply the adjustment on that verified user's behalf.
-- EXECUTE is intentionally restricted to service_role only: because this
-- function trusts its p_user_id argument instead of deriving it from
-- auth.uid(), granting it to anon/authenticated would let any caller pass
-- an arbitrary victim's user id and mint/burn against their stablecoins.
CREATE OR REPLACE FUNCTION public.adjust_stablecoin_supply_as(
  p_stablecoin_id UUID,
  p_user_id UUID,
  p_delta NUMERIC
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_supply NUMERIC;
BEGIN
  UPDATE private_stablecoins
  SET total_supply = (total_supply::numeric + p_delta)::text
  WHERE id = p_stablecoin_id
    AND user_id = p_user_id
    AND (total_supply::numeric + p_delta) >= 0
  RETURNING total_supply::numeric INTO v_new_supply;

  IF v_new_supply IS NULL THEN
    RAISE EXCEPTION 'Unable to adjust supply: stablecoin not found, not owned by specified user, or delta would make supply negative';
  END IF;

  RETURN v_new_supply::text;
END;
$$;

REVOKE ALL ON FUNCTION public.adjust_stablecoin_supply_as(UUID, UUID, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_stablecoin_supply_as(UUID, UUID, NUMERIC) TO service_role;
