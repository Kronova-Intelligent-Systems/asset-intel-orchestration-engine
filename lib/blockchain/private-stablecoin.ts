/**
 * Private Stablecoin Deployment System
 *
 * Enterprise-grade private stablecoin creation and management
 * Built on Canton Network with Circle USDC backing
 */

import { z } from "zod"
import { type CantonClient, getCantonClient, type StablecoinConfig, stablecoinConfigSchema } from "./canton-client"
import { type CircleUSDCClient, getCircleClient } from "./circle-usdc-client"

// ==================== Schemas ====================

export const deployStablecoinSchema = z.object({
  userId: z.string().uuid(),
  organizationId: z.string().uuid().optional(),
  config: stablecoinConfigSchema,
  initialMint: z.string().optional(), // Initial amount to mint
  reserveWalletAddress: z.string().optional(), // Address holding collateral
})

export const stablecoinOperationSchema = z.object({
  stablecoinId: z.string().uuid(),
  operationType: z.enum(["mint", "burn", "transfer", "freeze", "unfreeze", "blacklist", "whitelist"]),
  amount: z.string().optional(),
  targetAddress: z.string().optional(),
  reason: z.string().optional(),
})

export const stablecoinHolderSchema = z.object({
  partyId: z.string(),
  address: z.string(),
  balance: z.string(),
  kycStatus: z.enum(["pending", "approved", "rejected"]),
  whitelisted: z.boolean(),
  blacklisted: z.boolean(),
})

export type DeployStablecoinRequest = z.infer<typeof deployStablecoinSchema>
export type StablecoinOperation = z.infer<typeof stablecoinOperationSchema>
export type StablecoinHolder = z.infer<typeof stablecoinHolderSchema>

// Strictly a positive, non-zero base-10 integer with no leading zeros, sign,
// decimal point, or exponent. Rejects negative/zero amounts, which would
// otherwise let a "mint" silently decrease supply (or a "burn" increase it)
// once passed through BigInt() arithmetic downstream.
const POSITIVE_INTEGER_AMOUNT = /^[1-9][0-9]*$/

function assertValidAmount(amount: string): { valid: boolean; error?: string } {
  if (!POSITIVE_INTEGER_AMOUNT.test(amount)) {
    return { valid: false, error: "Amount must be a positive whole number (as a base-10 string)" }
  }
  // Guard against unreasonably large payloads before they hit BigInt/Canton/DB.
  if (amount.length > 30) {
    return { valid: false, error: "Amount exceeds maximum allowed magnitude" }
  }
  return { valid: true }
}

// ==================== Stablecoin Manager ====================

export class PrivateStablecoinManager {
  private cantonClient: CantonClient
  private circleClient: CircleUSDCClient
  private supabase: any

  constructor(supabaseClient: any, cantonConfig?: any, circleConfig?: any) {
    this.cantonClient = getCantonClient(cantonConfig)
    this.circleClient = getCircleClient(circleConfig)
    this.supabase = supabaseClient
  }

  /**
   * Deploy a new private stablecoin on Canton Network
   */
  async deployStablecoin(request: DeployStablecoinRequest): Promise<{
    success: boolean
    stablecoinId?: string
    contractId?: string
    error?: string
  }> {
    try {
      const validated = deployStablecoinSchema.parse(request)

      // Step 1: Validate configuration
      const configValidation = await this.validateStablecoinConfig(validated.config)
      if (!configValidation.valid) {
        return { success: false, error: configValidation.error }
      }

      // Step 2: Authenticate with Canton
      const authenticated = await this.cantonClient.authenticate({
        apiKey: process.env.CANTON_API_KEY,
      })
      if (!authenticated) {
        return { success: false, error: "Failed to authenticate with Canton Network" }
      }

      // Step 3: Allocate issuer party if not exists
      const issuerParty = await this.cantonClient.allocateParty(
        `${validated.config.symbol}-issuer`,
        `issuer-${validated.config.symbol.toLowerCase()}`,
      )

      // Step 4: Create stablecoin contract on Canton
      const stablecoinContract = await this.cantonClient.createContract("Stablecoin:PrivateStablecoin", {
        name: validated.config.name,
        symbol: validated.config.symbol,
        decimals: validated.config.decimals,
        totalSupply: "0", // Start with 0, mint separately
        issuer: issuerParty?.partyId || validated.config.issuer,
        backingType: validated.config.backingType,
        collateralRatio: validated.config.collateralRatio,
        kycRequired: validated.config.kycRequired,
        transferRestrictions: validated.config.transferRestrictions,
        complianceConfig: validated.config.complianceConfig,
        createdAt: new Date().toISOString(),
        status: "active",
      })

      if (!stablecoinContract) {
        return { success: false, error: "Failed to create stablecoin contract on Canton Network" }
      }

      // Step 5: Store stablecoin record in database
      const { data: stablecoinRecord, error: dbError } = await this.supabase
        .from("private_stablecoins")
        .insert({
          user_id: validated.userId,
          organization_id: validated.organizationId,
          name: validated.config.name,
          symbol: validated.config.symbol,
          decimals: validated.config.decimals,
          total_supply: "0",
          backing_type: validated.config.backingType,
          collateral_ratio: validated.config.collateralRatio,
          canton_contract_id: stablecoinContract.contractId,
          issuer_party_id: issuerParty?.partyId,
          config: validated.config,
          status: "active",
        })
        .select()
        .single()

      if (dbError) {
        console.error("[Stablecoin] Database error:", dbError)
        return { success: false, error: "Failed to save stablecoin record" }
      }

      // Step 6: Initial mint if requested
      if (validated.initialMint && validated.reserveWalletAddress) {
        const mintResult = await this.mintTokens({
          stablecoinId: stablecoinRecord.id,
          operationType: "mint",
          amount: validated.initialMint,
          targetAddress: validated.reserveWalletAddress,
          reason: "Initial mint",
        })

        if (!mintResult.success) {
          console.warn("[Stablecoin] Initial mint failed:", mintResult.error)
        }
      }

      return {
        success: true,
        stablecoinId: stablecoinRecord.id,
        contractId: stablecoinContract.contractId,
      }
    } catch (error) {
      console.error("[Stablecoin] Deployment error:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to deploy stablecoin",
      }
    }
  }

  /**
   * Validate stablecoin configuration
   */
  private async validateStablecoinConfig(config: StablecoinConfig): Promise<{ valid: boolean; error?: string }> {
    // Symbol uniqueness check
    const { data: existing } = await this.supabase
      .from("private_stablecoins")
      .select("id")
      .eq("symbol", config.symbol)
      .eq("status", "active")
      .single()

    if (existing) {
      return { valid: false, error: `Stablecoin with symbol ${config.symbol} already exists` }
    }

    // Collateral ratio validation
    if (config.backingType === "usdc" && config.collateralRatio < 100) {
      return { valid: false, error: "USDC-backed stablecoins require 100% collateral ratio" }
    }

    // Compliance validation
    if (config.kycRequired && config.transferRestrictions.length === 0) {
      return {
        valid: false,
        error: "KYC-required stablecoins must have at least one transfer restriction",
      }
    }

    return { valid: true }
  }

  /**
   * Mint new stablecoin tokens
   */
  async mintTokens(operation: StablecoinOperation): Promise<{
    success: boolean
    transactionId?: string
    newSupply?: string
    error?: string
  }> {
    try {
      if (operation.operationType !== "mint") {
        return { success: false, error: "Invalid operation type for minting" }
      }

      if (!operation.amount || !operation.targetAddress) {
        return { success: false, error: "Amount and target address are required" }
      }

      const amountCheck = assertValidAmount(operation.amount)
      if (!amountCheck.valid) {
        return { success: false, error: amountCheck.error }
      }

      // Get stablecoin record
      const { data: stablecoin, error } = await this.supabase
        .from("private_stablecoins")
        .select("*")
        .eq("id", operation.stablecoinId)
        .single()

      if (error || !stablecoin) {
        return { success: false, error: "Stablecoin not found" }
      }

      // For USDC-backed tokens, verify collateral
      if (stablecoin.backing_type === "usdc") {
        const collateralVerified = await this.verifyCollateral(
          stablecoin.id,
          operation.amount,
          stablecoin.collateral_ratio,
        )

        if (!collateralVerified.verified) {
          return { success: false, error: collateralVerified.error }
        }
      }

      // Execute mint on Canton
      const mintResult = await this.cantonClient.exerciseChoice(
        stablecoin.canton_contract_id,
        "Stablecoin:PrivateStablecoin",
        "Mint",
        {
          amount: operation.amount,
          recipient: operation.targetAddress,
          reason: operation.reason || "Token mint",
        },
      )

      if (!mintResult) {
        return { success: false, error: "Canton mint transaction failed" }
      }

      // Update total supply atomically (single UPDATE inside a SQL function)
      // instead of read-then-write, so concurrent mint/burn calls can't lose
      // an update or race past the collateral check with a stale supply.
      const { data: newSupply, error: supplyError } = await this.supabase.rpc("adjust_stablecoin_supply", {
        p_stablecoin_id: operation.stablecoinId,
        p_delta: operation.amount,
      })

      if (supplyError || !newSupply) {
        console.error("[Stablecoin] Supply update error:", supplyError)
        return { success: false, error: "Failed to update supply record after mint" }
      }

      // Record operation
      await this.recordOperation(operation, mintResult.transactionId, "completed")

      return {
        success: true,
        transactionId: mintResult.transactionId,
        newSupply,
      }
    } catch (error) {
      console.error("[Stablecoin] Mint error:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to mint tokens",
      }
    }
  }

  /**
   * Burn stablecoin tokens
   */
  async burnTokens(operation: StablecoinOperation): Promise<{
    success: boolean
    transactionId?: string
    newSupply?: string
    error?: string
  }> {
    try {
      if (operation.operationType !== "burn") {
        return { success: false, error: "Invalid operation type for burning" }
      }

      if (!operation.amount) {
        return { success: false, error: "Amount is required" }
      }

      const amountCheck = assertValidAmount(operation.amount)
      if (!amountCheck.valid) {
        return { success: false, error: amountCheck.error }
      }

      // Get stablecoin record
      const { data: stablecoin, error } = await this.supabase
        .from("private_stablecoins")
        .select("*")
        .eq("id", operation.stablecoinId)
        .single()

      if (error || !stablecoin) {
        return { success: false, error: "Stablecoin not found" }
      }

      // Validate burn amount (best-effort pre-check; the atomic RPC below is
      // the authoritative guard against a race making supply go negative)
      if (BigInt(operation.amount) > BigInt(stablecoin.total_supply || "0")) {
        return { success: false, error: "Burn amount exceeds total supply" }
      }

      // Execute burn on Canton
      const burnResult = await this.cantonClient.exerciseChoice(
        stablecoin.canton_contract_id,
        "Stablecoin:PrivateStablecoin",
        "Burn",
        {
          amount: operation.amount,
          reason: operation.reason || "Token burn",
        },
      )

      if (!burnResult) {
        return { success: false, error: "Canton burn transaction failed" }
      }

      // Update total supply atomically; see mintTokens for why this can't be
      // a JS read-then-write.
      const { data: newSupply, error: supplyError } = await this.supabase.rpc("adjust_stablecoin_supply", {
        p_stablecoin_id: operation.stablecoinId,
        p_delta: `-${operation.amount}`,
      })

      if (supplyError || !newSupply) {
        console.error("[Stablecoin] Supply update error:", supplyError)
        return { success: false, error: "Failed to update supply record after burn" }
      }

      // Record operation
      await this.recordOperation(operation, burnResult.transactionId, "completed")

      return {
        success: true,
        transactionId: burnResult.transactionId,
        newSupply,
      }
    } catch (error) {
      console.error("[Stablecoin] Burn error:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to burn tokens",
      }
    }
  }

  /**
   * Transfer tokens between parties
   */
  async transferTokens(operation: StablecoinOperation): Promise<{
    success: boolean
    transactionId?: string
    error?: string
  }> {
    try {
      if (operation.operationType !== "transfer") {
        return { success: false, error: "Invalid operation type" }
      }

      if (!operation.amount || !operation.targetAddress) {
        return { success: false, error: "Amount and target address required" }
      }

      // Get stablecoin record
      const { data: stablecoin, error } = await this.supabase
        .from("private_stablecoins")
        .select("*")
        .eq("id", operation.stablecoinId)
        .single()

      if (error || !stablecoin) {
        return { success: false, error: "Stablecoin not found" }
      }

      // Check compliance if required
      if (stablecoin.config?.kycRequired) {
        const compliance = await this.checkTransferCompliance(stablecoin.id, operation.targetAddress, operation.amount)

        if (!compliance.allowed) {
          return { success: false, error: compliance.reason }
        }
      }

      // Execute transfer on Canton
      const transferResult = await this.cantonClient.exerciseChoice(
        stablecoin.canton_contract_id,
        "Stablecoin:PrivateStablecoin",
        "Transfer",
        {
          amount: operation.amount,
          recipient: operation.targetAddress,
        },
      )

      if (!transferResult) {
        return { success: false, error: "Canton transfer transaction failed" }
      }

      // Record operation
      await this.recordOperation(operation, transferResult.transactionId, "completed")

      return {
        success: true,
        transactionId: transferResult.transactionId,
      }
    } catch (error) {
      console.error("[Stablecoin] Transfer error:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to transfer tokens",
      }
    }
  }

  /**
   * Freeze/Unfreeze account
   */
  async freezeAccount(
    stablecoinId: string,
    targetAddress: string,
    freeze: boolean,
    reason: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: stablecoin, error } = await this.supabase
        .from("private_stablecoins")
        .select("*")
        .eq("id", stablecoinId)
        .single()

      if (error || !stablecoin) {
        return { success: false, error: "Stablecoin not found" }
      }

      const choiceName = freeze ? "Freeze" : "Unfreeze"

      const result = await this.cantonClient.exerciseChoice(
        stablecoin.canton_contract_id,
        "Stablecoin:PrivateStablecoin",
        choiceName,
        {
          account: targetAddress,
          reason,
        },
      )

      if (!result) {
        return { success: false, error: `Failed to ${freeze ? "freeze" : "unfreeze"} account` }
      }

      // Record operation
      await this.recordOperation(
        {
          stablecoinId,
          operationType: freeze ? "freeze" : "unfreeze",
          targetAddress,
          reason,
        },
        result.transactionId,
        "completed",
      )

      return { success: true }
    } catch (error) {
      console.error("[Stablecoin] Freeze error:", error)
      return { success: false, error: "Failed to modify account status" }
    }
  }

  /**
   * Add/Remove from whitelist
   */
  async updateWhitelist(
    stablecoinId: string,
    address: string,
    add: boolean,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: stablecoin, error } = await this.supabase
        .from("private_stablecoins")
        .select("*")
        .eq("id", stablecoinId)
        .single()

      if (error || !stablecoin) {
        return { success: false, error: "Stablecoin not found" }
      }

      const choiceName = add ? "AddToWhitelist" : "RemoveFromWhitelist"

      const result = await this.cantonClient.exerciseChoice(
        stablecoin.canton_contract_id,
        "Stablecoin:PrivateStablecoin",
        choiceName,
        { account: address },
      )

      if (!result) {
        return { success: false, error: "Failed to update whitelist" }
      }

      return { success: true }
    } catch (error) {
      console.error("[Stablecoin] Whitelist error:", error)
      return { success: false, error: "Failed to update whitelist" }
    }
  }

  /**
   * Verify collateral for USDC-backed stablecoins
   */
  private async verifyCollateral(
    stablecoinId: string,
    mintAmount: string,
    collateralRatio: number,
  ): Promise<{ verified: boolean; error?: string }> {
    try {
      // Get reserve wallet info
      const { data: stablecoin } = await this.supabase
        .from("private_stablecoins")
        .select("config")
        .eq("id", stablecoinId)
        .single()

      const reserveAddress = stablecoin?.config?.reserveWalletAddress

      if (!reserveAddress) {
        return { verified: false, error: "Reserve wallet not configured" }
      }

      // Check Circle USDC balance
      const balance = await this.circleClient.getChainBalance("ETH", reserveAddress)

      const requiredCollateral = (BigInt(mintAmount) * BigInt(collateralRatio)) / BigInt(100)

      if (BigInt(balance) < requiredCollateral) {
        return {
          verified: false,
          error: `Insufficient collateral. Required: ${requiredCollateral}, Available: ${balance}`,
        }
      }

      return { verified: true }
    } catch (error) {
      console.error("[Stablecoin] Collateral verification error:", error)
      return { verified: false, error: "Failed to verify collateral" }
    }
  }

  /**
   * Check transfer compliance
   */
  private async checkTransferCompliance(
    stablecoinId: string,
    targetAddress: string,
    amount: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const { data: stablecoin } = await this.supabase
        .from("private_stablecoins")
        .select("config")
        .eq("id", stablecoinId)
        .single()

      const config = stablecoin?.config?.complianceConfig

      // Sanctions screening
      if (config?.sanctionsScreening) {
        const screening = await this.circleClient.screenAddress(targetAddress, "ETH")
        if (!screening.passed) {
          return { allowed: false, reason: "Address failed compliance screening" }
        }
      }

      // Amount limits
      if (config?.maxTransactionAmount) {
        if (BigInt(amount) > BigInt(config.maxTransactionAmount)) {
          return { allowed: false, reason: "Amount exceeds maximum transaction limit" }
        }
      }

      // Check whitelist
      const { data: holder } = await this.supabase
        .from("stablecoin_holders")
        .select("whitelisted, blacklisted, kyc_status")
        .eq("stablecoin_id", stablecoinId)
        .eq("address", targetAddress)
        .single()

      if (holder?.blacklisted) {
        return { allowed: false, reason: "Target address is blacklisted" }
      }

      const restrictions = stablecoin?.config?.transferRestrictions || []
      if (restrictions.includes("whitelist") && !holder?.whitelisted) {
        return { allowed: false, reason: "Target address is not whitelisted" }
      }

      if (stablecoin?.config?.kycRequired && holder?.kyc_status !== "approved") {
        return { allowed: false, reason: "Target address has not completed KYC" }
      }

      return { allowed: true }
    } catch (error) {
      console.error("[Stablecoin] Compliance check error:", error)
      return { allowed: false, reason: "Compliance check failed" }
    }
  }

  /**
   * Record operation in database
   */
  private async recordOperation(
    operation: StablecoinOperation,
    transactionId: string,
    status: "pending" | "completed" | "failed",
  ): Promise<void> {
    try {
      await this.supabase.from("stablecoin_operations").insert({
        stablecoin_id: operation.stablecoinId,
        operation_type: operation.operationType,
        amount: operation.amount,
        target_address: operation.targetAddress,
        reason: operation.reason,
        canton_transaction_id: transactionId,
        status,
      })
    } catch (error) {
      console.error("[Stablecoin] Error recording operation:", error)
    }
  }

  /**
   * Get stablecoin details
   */
  async getStablecoin(stablecoinId: string): Promise<any> {
    const { data, error } = await this.supabase.from("private_stablecoins").select("*").eq("id", stablecoinId).single()

    if (error) return null
    return data
  }

  /**
   * Get all stablecoins for a user
   */
  async getUserStablecoins(userId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from("private_stablecoins")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) return []
    return data || []
  }

  /**
   * Get stablecoin holders
   */
  async getHolders(stablecoinId: string): Promise<StablecoinHolder[]> {
    const { data, error } = await this.supabase.from("stablecoin_holders").select("*").eq("stablecoin_id", stablecoinId)

    if (error) return []
    return data || []
  }

  /**
   * Get operation history
   */
  async getOperationHistory(stablecoinId: string, limit = 50): Promise<any[]> {
    const { data, error } = await this.supabase
      .from("stablecoin_operations")
      .select("*")
      .eq("stablecoin_id", stablecoinId)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) return []
    return data || []
  }
}

// ==================== Factory Function ====================

export function createStablecoinManager(supabaseClient: any): PrivateStablecoinManager {
  return new PrivateStablecoinManager(supabaseClient)
}
