/**
 * Supabase Edge Function: Stablecoin Operations
 *
 * Handles async stablecoin operations including:
 * - Minting with collateral verification
 * - Burning with L1 release
 * - Compliance screening
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
// `Deno` is a runtime global in the Edge Functions environment; it does not
// need to be (and cannot correctly be) imported from an std module.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface StablecoinOperationRequest {
  operationType: "mint" | "burn" | "verify-collateral" | "compliance-check"
  stablecoinId: string
  amount?: string
  targetAddress?: string
}

// Base-10 positive, non-zero integer only. Rejects negative/zero amounts,
// which would otherwise let "mint" decrease supply or "burn" increase it
// once passed through BigInt() arithmetic below.
const POSITIVE_INTEGER_AMOUNT = /^[1-9][0-9]*$/

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const serviceRoleClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "")

    // Identify the real caller from their Supabase-issued JWT rather than
    // trusting a client-supplied `userId` field (which previously let
    // anyone mint/burn against ANY stablecoin by simply naming its owner).
    const authHeader = req.headers.get("Authorization") ?? ""
    const jwt = authHeader.replace(/^Bearer\s+/i, "")

    if (!jwt) {
      return new Response(JSON.stringify({ success: false, error: "Authentication required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      })
    }

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "")
    const {
      data: { user },
      error: authError,
    } = await anonClient.auth.getUser(jwt)

    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: "Invalid or expired session" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      })
    }

    const body: StablecoinOperationRequest = await req.json()
    const { operationType, stablecoinId, amount, targetAddress } = body

    // Get stablecoin record
    const { data: stablecoin, error: stablecoinError } = await serviceRoleClient
      .from("private_stablecoins")
      .select("*")
      .eq("id", stablecoinId)
      .single()

    if (stablecoinError || !stablecoin) {
      return new Response(JSON.stringify({ success: false, error: "Stablecoin not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      })
    }

    // Ownership check: only the stablecoin's owner may mint/burn/verify it.
    // This must be checked here because this function uses the service-role
    // client, which bypasses the private_stablecoins RLS policies entirely.
    if (stablecoin.user_id !== user.id) {
      return new Response(JSON.stringify({ success: false, error: "Access denied" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      })
    }

    if ((operationType === "mint" || operationType === "burn") && !POSITIVE_INTEGER_AMOUNT.test(amount ?? "")) {
      return new Response(
        JSON.stringify({ success: false, error: "Amount must be a positive whole number" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      )
    }

    let result: any

    switch (operationType) {
      case "verify-collateral":
        result = await verifyCollateral(serviceRoleClient, stablecoin, amount || "0")
        break

      case "compliance-check":
        result = await performComplianceCheck(stablecoin, targetAddress || "")
        break

      case "mint":
        result = await processMint(serviceRoleClient, stablecoin, amount || "0", targetAddress || "", user.id)
        break

      case "burn":
        result = await processBurn(serviceRoleClient, stablecoin, amount || "0", user.id)
        break

      default:
        return new Response(JSON.stringify({ success: false, error: "Invalid operation type" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        })
    }

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
  } catch (error) {
    console.error("[Stablecoin Edge Function] Error:", error)
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    })
  }
})

async function verifyCollateral(
  supabase: any,
  stablecoin: any,
  amount: string,
): Promise<{ verified: boolean; collateralBalance?: string; requiredAmount?: string; error?: string }> {
  try {
    // Get reserve information
    const { data: reserve } = await supabase
      .from("stablecoin_reserves")
      .select("*")
      .eq("stablecoin_id", stablecoin.id)
      .single()

    if (!reserve) {
      return { verified: false, error: "No reserve configured" }
    }

    const requiredCollateral = (BigInt(amount) * BigInt(Math.floor(stablecoin.collateral_ratio * 100))) / BigInt(10000)

    const hasEnoughCollateral = BigInt(reserve.collateral_amount) >= requiredCollateral

    return {
      verified: hasEnoughCollateral,
      collateralBalance: reserve.collateral_amount,
      requiredAmount: requiredCollateral.toString(),
      error: hasEnoughCollateral ? undefined : "Insufficient collateral",
    }
  } catch (error) {
    console.error("[Collateral Verification] Error:", error)
    return { verified: false, error: "Verification failed" }
  }
}

async function performComplianceCheck(
  stablecoin: any,
  targetAddress: string,
): Promise<{ passed: boolean; riskScore?: number; flags?: string[] }> {
  try {
    const config = stablecoin.config?.complianceConfig

    // Basic sanctions screening simulation
    // In production, this would call Circle's compliance API
    const riskScore = Math.random() * 100

    const flags: string[] = []
    if (riskScore > 70) flags.push("high_risk_score")

    return {
      passed: riskScore < 70,
      riskScore,
      flags,
    }
  } catch (error) {
    console.error("[Compliance Check] Error:", error)
    return { passed: false, flags: ["check_failed"] }
  }
}

async function processMint(
  supabase: any,
  stablecoin: any,
  amount: string,
  targetAddress: string,
  verifiedUserId: string,
): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  try {
    // Verify collateral first
    const collateralCheck = await verifyCollateral(supabase, stablecoin, amount)
    if (!collateralCheck.verified) {
      return { success: false, error: collateralCheck.error }
    }

    // Record the operation
    const { data: operation, error } = await supabase
      .from("stablecoin_operations")
      .insert({
        stablecoin_id: stablecoin.id,
        operation_type: "mint",
        amount,
        target_address: targetAddress,
        status: "completed",
        canton_transaction_id: `canton-${Date.now()}`,
      })
      .select()
      .single()

    if (error) {
      return { success: false, error: "Failed to record operation" }
    }

    // Update total supply atomically, re-checking ownership against the
    // already-verified caller id inside the same UPDATE statement. This
    // avoids the lost-update race a JS read-then-write would allow under
    // concurrent mint/burn calls, which could otherwise let concurrent
    // requests each pass the collateral check above against a stale supply.
    const { data: newSupply, error: supplyError } = await supabase.rpc("adjust_stablecoin_supply_as", {
      p_stablecoin_id: stablecoin.id,
      p_user_id: verifiedUserId,
      p_delta: amount,
    })

    if (supplyError || !newSupply) {
      console.error("[Process Mint] Supply update error:", supplyError)
      return { success: false, error: "Failed to update supply record after mint" }
    }

    return {
      success: true,
      transactionId: operation.canton_transaction_id,
    }
  } catch (error) {
    console.error("[Process Mint] Error:", error)
    return { success: false, error: "Mint processing failed" }
  }
}

async function processBurn(
  supabase: any,
  stablecoin: any,
  amount: string,
  verifiedUserId: string,
): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  try {
    // Validate burn amount (best-effort pre-check; the atomic RPC below is
    // the authoritative guard against a race making supply go negative)
    if (BigInt(amount) > BigInt(stablecoin.total_supply || "0")) {
      return { success: false, error: "Burn amount exceeds total supply" }
    }

    // Record the operation
    const { data: operation, error } = await supabase
      .from("stablecoin_operations")
      .insert({
        stablecoin_id: stablecoin.id,
        operation_type: "burn",
        amount,
        status: "completed",
        canton_transaction_id: `canton-${Date.now()}`,
      })
      .select()
      .single()

    if (error) {
      return { success: false, error: "Failed to record operation" }
    }

    // Update total supply atomically; see processMint for why this can't
    // be a JS read-then-write.
    const { data: newSupply, error: supplyError } = await supabase.rpc("adjust_stablecoin_supply_as", {
      p_stablecoin_id: stablecoin.id,
      p_user_id: verifiedUserId,
      p_delta: `-${amount}`,
    })

    if (supplyError || !newSupply) {
      console.error("[Process Burn] Supply update error:", supplyError)
      return { success: false, error: "Failed to update supply record after burn" }
    }

    return {
      success: true,
      transactionId: operation.canton_transaction_id,
    }
  } catch (error) {
    console.error("[Process Burn] Error:", error)
    return { success: false, error: "Burn processing failed" }
  }
}
