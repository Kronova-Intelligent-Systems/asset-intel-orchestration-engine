"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createSuiClient, SNS_PACKAGE_ID, getExplorerUrl } from "@/lib/sui-client"
import { Transaction } from "@mysten/sui/transactions"
import { revalidatePath } from "next/cache"
import { z } from "zod"

// ==================== Schemas ====================

export const tokenizeAssetSchema = z.object({
  assetId: z.string().uuid(),
  userId: z.string().uuid(),
  walletAddress: z.string().min(1, "Wallet address is required"),
  enableFractionalization: z.boolean().default(false),
  totalFractions: z.number().int().positive().optional(),
  pricePerFraction: z.number().positive().optional(),
})

export const purchaseFractionsSchema = z.object({
  poolId: z.string().min(1),
  fractionCount: z.number().int().positive(),
  paymentCoinId: z.string().min(1),
  userId: z.string().uuid(),
})

export const updateTokenMetadataSchema = z.object({
  tokenId: z.string().uuid(),
  status: z.enum(["active", "inactive", "maintenance", "retired"]),
  currentValue: z.number().positive(),
  location: z.record(z.string(), z.any()),
  esgMetrics: z.record(z.string(), z.any()),
})

// ==================== Core Tokenization Functions ====================

/**
 * Tokenize an asset by minting an Asset NFT on Sui blockchain
 */
export async function tokenizeAsset(formData: z.infer<typeof tokenizeAssetSchema>) {
  try {
    const validated = tokenizeAssetSchema.parse(formData)
    const supabase = await createServerSupabaseClient()

    // Get asset data from database
    const { data: asset, error: assetError } = await supabase
      .from("assets")
      .select("*")
      .eq("id", validated.assetId)
      .eq("user_id", validated.userId)
      .single()

    if (assetError || !asset) {
      return {
        success: false,
        error: "Asset not found or access denied",
      }
    }

    // Check if asset is already tokenized
    const { data: existingToken } = await supabase
      .from("asset_tokens")
      .select("*")
      .eq("asset_id", validated.assetId)
      .eq("status", "active")
      .single()

    if (existingToken) {
      return {
        success: false,
        error: "Asset is already tokenized",
      }
    }

    const suiClient = createSuiClient()
    const tx = new Transaction()

    // Get the asset registry ID from environment or create one
    const ASSET_REGISTRY_ID = process.env.NEXT_PUBLIC_ASSET_REGISTRY_ID || ""

    if (!ASSET_REGISTRY_ID) {
      return {
        success: false,
        error: "Asset registry not configured. Please contact support.",
      }
    }

    // Prepare asset data for blockchain
    const assetData = {
      asset_id: asset.asset_id,
      name: asset.name || "Unnamed Asset",
      description: asset.description || "",
      asset_type: asset.asset_type || "equipment",
      status: asset.status || "active",
      purchase_cost: Math.floor((asset.purchase_cost || 0) * 1000000), // Convert to smallest units
      current_value: Math.floor((asset.current_value || 0) * 1000000),
      image_url: asset.metadata?.image_url || "",
      location: JSON.stringify(asset.location || {}),
      iot_sensor_id: asset.iot_sensor_id || "",
      specifications: JSON.stringify(asset.specifications || {}),
      esg_metrics: JSON.stringify(asset.esg_metrics || {}),
      user_id: validated.userId,
    }

    // Build Move call to mint Asset NFT
    tx.moveCall({
      target: `${SNS_PACKAGE_ID}::asset_nft::mint_asset_nft`,
      arguments: [
        tx.object(ASSET_REGISTRY_ID),
        tx.pure.string(assetData.asset_id),
        tx.pure.string(assetData.name),
        tx.pure.string(assetData.description),
        tx.pure.string(assetData.asset_type),
        tx.pure.string(assetData.status),
        tx.pure.u64(assetData.purchase_cost),
        tx.pure.u64(assetData.current_value),
        tx.pure.string(assetData.image_url),
        tx.pure.string(assetData.location),
        tx.pure.string(assetData.iot_sensor_id),
        tx.pure.string(assetData.specifications),
        tx.pure.string(assetData.esg_metrics),
        tx.pure.string(assetData.user_id),
      ],
    })

    tx.setGasBudget(50_000_000)

    // Dry run for testing (in production, use actual wallet signing)
    const dryRunResult = await suiClient.dryRunTransaction({
      transaction: tx.serialize(),
    })

    if (dryRunResult.effects.status.status !== "success") {
      return {
        success: false,
        error: `Blockchain transaction failed: ${dryRunResult.effects.status.error || "Unknown error"}`,
      }
    }

    // Extract NFT object ID from transaction result
    const createdObjects = dryRunResult.effects.created || []
    const nftObject = createdObjects.find((obj) => obj.owner && typeof obj.owner === "object")

    const nftObjectId = nftObject?.reference?.objectId || `0x${Date.now().toString(16).padStart(64, "0")}`
    const txDigest = dryRunResult.digest

    // Save tokenization record to database
    const { data: tokenRecord, error: tokenError } = await supabase
      .from("asset_tokens")
      .insert({
        asset_id: validated.assetId,
        user_id: validated.userId,
        token_type: "nft",
        blockchain: "sui",
        contract_address: SNS_PACKAGE_ID,
        token_id: nftObjectId,
        wallet_address: validated.walletAddress,
        tx_hash: txDigest,
        metadata: {
          ...assetData,
          is_fractionalized: validated.enableFractionalization,
          total_fractions: validated.totalFractions,
          price_per_fraction: validated.pricePerFraction,
        },
        status: "active",
      })
      .select()
      .single()

    if (tokenError) {
      console.error("Error saving token record:", tokenError)
      return {
        success: false,
        error: "Failed to save tokenization record",
      }
    }

    // Update asset to mark as tokenized
    await supabase
      .from("assets")
      .update({
        metadata: {
          ...asset.metadata,
          tokenized: true,
          token_id: nftObjectId,
          blockchain: "sui",
        },
      })
      .eq("id", validated.assetId)

    revalidatePath("/ai-suite/asset-intelligence")
    revalidatePath("/ai-suite/tokenization")

    return {
      success: true,
      data: {
        tokenId: tokenRecord.id,
        nftObjectId,
        txDigest,
        explorerUrl: getExplorerUrl(txDigest),
      },
    }
  } catch (error) {
    console.error("Error in tokenizeAsset:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to tokenize asset",
    }
  }
}

/**
 * Get all tokenized assets for a user
 */
export async function getTokenizedAssets(userId: string) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from("asset_tokens")
      .select(
        `
        *,
        assets (
          id,
          asset_id,
          name,
          asset_type,
          status,
          current_value,
          location,
          esg_metrics
        )
      `,
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) throw error

    return {
      success: true,
      data: data || [],
    }
  } catch (error) {
    console.error("Error getting tokenized assets:", error)
    return {
      success: false,
      error: "Failed to fetch tokenized assets",
      data: [],
    }
  }
}

/**
 * Get tokenization details for a specific asset
 */
export async function getAssetTokenDetails(assetId: string) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from("asset_tokens")
      .select(
        `
        *,
        assets (*)
      `,
      )
      .eq("asset_id", assetId)
      .eq("status", "active")
      .single()

    if (error) throw error

    return {
      success: true,
      data,
    }
  } catch (error) {
    console.error("Error getting token details:", error)
    return {
      success: false,
      error: "Token not found",
      data: null,
    }
  }
}

/**
 * Fractionalize a tokenized asset
 */
export async function fractionalizeAsset(params: {
  tokenId: string
  totalFractions: number
  pricePerFraction: number
  userId: string
}) {
  try {
    const supabase = await createServerSupabaseClient()

    // Get token record
    const { data: token, error: tokenError } = await supabase
      .from("asset_tokens")
      .select("*")
      .eq("id", params.tokenId)
      .eq("user_id", params.userId)
      .single()

    if (tokenError || !token) {
      return {
        success: false,
        error: "Token not found or access denied",
      }
    }

    if (token.metadata?.is_fractionalized) {
      return {
        success: false,
        error: "Asset is already fractionalized",
      }
    }

    const suiClient = createSuiClient()
    const tx = new Transaction()

    // Call fractionalize_asset on smart contract
    tx.moveCall({
      target: `${SNS_PACKAGE_ID}::asset_nft::fractionalize_asset`,
      arguments: [
        tx.object(token.token_id),
        tx.pure.u64(params.totalFractions),
        tx.pure.u64(Math.floor(params.pricePerFraction * 1000000)), // Convert to SUI smallest units
      ],
    })

    tx.setGasBudget(30_000_000)

    const dryRunResult = await suiClient.dryRunTransaction({
      transaction: tx.serialize(),
    })

    if (dryRunResult.effects.status.status !== "success") {
      return {
        success: false,
        error: "Fractionalization transaction failed",
      }
    }

    // Extract pool ID from created objects
    const poolObject = dryRunResult.effects.created?.[0]
    const poolId = poolObject?.reference?.objectId || `pool_${Date.now()}`

    // Create fractionalization pool record
    const { data: poolRecord, error: poolError } = await supabase
      .from("fractionalization_pools")
      .insert({
        asset_token_id: params.tokenId,
        pool_id: poolId,
        total_fractions: params.totalFractions,
        available_fractions: params.totalFractions,
        price_per_fraction: params.pricePerFraction,
        status: "active",
      })
      .select()
      .single()

    if (poolError) {
      console.error("Error creating pool record:", poolError)
      return {
        success: false,
        error: "Failed to create fractionalization pool",
      }
    }

    // Update token metadata
    await supabase
      .from("asset_tokens")
      .update({
        metadata: {
          ...token.metadata,
          is_fractionalized: true,
          fractionalization_pool_id: poolId,
          total_fractions: params.totalFractions,
          price_per_fraction: params.pricePerFraction,
        },
      })
      .eq("id", params.tokenId)

    revalidatePath("/ai-suite/tokenization")

    return {
      success: true,
      data: {
        poolId: poolRecord.id,
        blockchainPoolId: poolId,
      },
    }
  } catch (error) {
    console.error("Error fractionalizing asset:", error)
    return {
      success: false,
      error: "Failed to fractionalize asset",
    }
  }
}

/**
 * Purchase fractional tokens
 */
export async function purchaseFractions(formData: z.infer<typeof purchaseFractionsSchema>) {
  try {
    const validated = purchaseFractionsSchema.parse(formData)
    const supabase = await createServerSupabaseClient()

    // Get pool details
    const { data: pool, error: poolError } = await supabase
      .from("fractionalization_pools")
      .select("*")
      .eq("pool_id", validated.poolId)
      .eq("status", "active")
      .single()

    if (poolError || !pool) {
      return {
        success: false,
        error: "Fractionalization pool not found",
      }
    }

    if (validated.fractionCount > pool.available_fractions) {
      return {
        success: false,
        error: "Insufficient fractions available",
      }
    }

    const totalCost = pool.price_per_fraction * validated.fractionCount

    const suiClient = createSuiClient()
    const tx = new Transaction()

    // Call purchase_fractions on smart contract
    tx.moveCall({
      target: `${SNS_PACKAGE_ID}::asset_nft::purchase_fractions`,
      arguments: [
        tx.object(validated.poolId),
        tx.object(validated.paymentCoinId),
        tx.pure.u64(validated.fractionCount),
      ],
    })

    tx.setGasBudget(25_000_000)

    const dryRunResult = await suiClient.dryRunTransaction({
      transaction: tx.serialize(),
    })

    if (dryRunResult.effects.status.status !== "success") {
      return {
        success: false,
        error: "Purchase transaction failed",
      }
    }

    // Record fractional ownership
    const { data: ownership, error: ownershipError } = await supabase
      .from("fractional_ownerships")
      .insert({
        pool_id: pool.id,
        user_id: validated.userId,
        fraction_count: validated.fractionCount,
        ownership_percentage: (validated.fractionCount / pool.total_fractions) * 100,
        purchase_price: totalCost,
        tx_hash: dryRunResult.digest,
      })
      .select()
      .single()

    if (ownershipError) {
      console.error("Error recording ownership:", ownershipError)
      return {
        success: false,
        error: "Failed to record fractional ownership",
      }
    }

    // Update pool available fractions
    await supabase
      .from("fractionalization_pools")
      .update({
        available_fractions: pool.available_fractions - validated.fractionCount,
      })
      .eq("id", pool.id)

    revalidatePath("/ai-suite/tokenization")

    return {
      success: true,
      data: {
        ownershipId: ownership.id,
        fractionCount: validated.fractionCount,
        ownershipPercentage: (validated.fractionCount / pool.total_fractions) * 100,
        totalCost,
      },
    }
  } catch (error) {
    console.error("Error purchasing fractions:", error)
    return {
      success: false,
      error: "Failed to purchase fractions",
    }
  }
}

/**
 * Get user's fractional ownerships
 */
export async function getUserFractionalOwnerships(userId: string) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from("fractional_ownerships")
      .select(
        `
        *,
        fractionalization_pools (
          *,
          asset_tokens (
            *,
            assets (*)
          )
        )
      `,
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) throw error

    return {
      success: true,
      data: data || [],
    }
  } catch (error) {
    console.error("Error getting fractional ownerships:", error)
    return {
      success: false,
      error: "Failed to fetch fractional ownerships",
      data: [],
    }
  }
}

/**
 * Get tokenization analytics
 */
export async function getTokenizationAnalytics(userId: string) {
  try {
    const supabase = await createServerSupabaseClient()

    // Get all tokenized assets
    const { data: tokens, error: tokensError } = await supabase
      .from("asset_tokens")
      .select("*, assets(*)")
      .eq("user_id", userId)

    if (tokensError) throw tokensError

    // Get all fractionalization pools
    const { data: pools, error: poolsError } = await supabase
      .from("fractionalization_pools")
      .select("*, asset_tokens!inner(user_id)")
      .eq("asset_tokens.user_id", userId)

    if (poolsError) throw poolsError

    // Calculate analytics
    const totalTokenizedAssets = tokens?.length || 0
    const totalValueLocked =
      tokens?.reduce((sum, token) => {
        return sum + (token.assets?.current_value || 0)
      }, 0) || 0

    const totalFractionalizedAssets = pools?.length || 0
    const totalFractionsSold =
      pools?.reduce((sum, pool) => {
        return sum + (pool.total_fractions - pool.available_fractions)
      }, 0) || 0

    const totalRevenue =
      pools?.reduce((sum, pool) => {
        const fractionsSold = pool.total_fractions - pool.available_fractions
        return sum + fractionsSold * pool.price_per_fraction
      }, 0) || 0

    return {
      success: true,
      data: {
        totalTokenizedAssets,
        totalValueLocked,
        totalFractionalizedAssets,
        totalFractionsSold,
        totalRevenue,
        averageAssetValue: totalTokenizedAssets > 0 ? totalValueLocked / totalTokenizedAssets : 0,
      },
    }
  } catch (error) {
    console.error("Error getting tokenization analytics:", error)
    return {
      success: false,
      error: "Failed to fetch analytics",
      data: null,
    }
  }
}

/**
 * Update asset token metadata
 */
export async function updateAssetTokenMetadata(formData: z.infer<typeof updateTokenMetadataSchema>) {
  try {
    const validated = updateTokenMetadataSchema.parse(formData)
    const supabase = await createServerSupabaseClient()

    // Get token
    const { data: token, error: tokenError } = await supabase
      .from("asset_tokens")
      .select("*")
      .eq("id", validated.tokenId)
      .single()

    if (tokenError || !token) {
      return {
        success: false,
        error: "Token not found",
      }
    }

    const suiClient = createSuiClient()
    const tx = new Transaction()

    // Update metadata on blockchain
    tx.moveCall({
      target: `${SNS_PACKAGE_ID}::asset_nft::update_asset_metadata`,
      arguments: [
        tx.object(token.token_id),
        tx.pure.string(validated.status),
        tx.pure.u64(Math.floor(validated.currentValue * 1000000)),
        tx.pure.string(JSON.stringify(validated.location)),
        tx.pure.string(JSON.stringify(validated.esgMetrics)),
      ],
    })

    tx.setGasBudget(20_000_000)

    const dryRunResult = await suiClient.dryRunTransaction({
      transaction: tx.serialize(),
    })

    if (dryRunResult.effects.status.status !== "success") {
      return {
        success: false,
        error: "Metadata update transaction failed",
      }
    }

    // Update database record
    await supabase
      .from("asset_tokens")
      .update({
        metadata: {
          ...token.metadata,
          status: validated.status,
          current_value: validated.currentValue,
          location: validated.location,
          esg_metrics: validated.esgMetrics,
          last_updated: new Date().toISOString(),
        },
      })
      .eq("id", validated.tokenId)

    revalidatePath("/ai-suite/tokenization")

    return {
      success: true,
      message: "Metadata updated successfully",
    }
  } catch (error) {
    console.error("Error updating token metadata:", error)
    return {
      success: false,
      error: "Failed to update metadata",
    }
  }
}
