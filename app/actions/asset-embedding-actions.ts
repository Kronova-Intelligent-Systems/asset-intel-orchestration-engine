"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { AssetEmbeddingSystem } from "@/lib/embeddings/asset-embedding-system"
import { revalidatePath } from "next/cache"
import * as z from "zod"

// Schema for asset embedding creation
const createAssetEmbeddingsSchema = z.object({
  asset_ids: z.array(z.string().uuid()).min(1, "At least one asset ID is required"),
  include_profile: z.boolean().default(true),
  include_lifecycle_events: z.boolean().default(true),
  include_insights: z.boolean().default(true),
  include_iot_data: z.boolean().default(false),
})

// Schema for asset search
const assetSearchSchema = z.object({
  query: z.string().min(1, "Search query is required"),
  asset_types: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  document_types: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(50).default(10),
  threshold: z.number().min(0).max(1).default(0.7),
})

// Schema for asset recommendations
const assetRecommendationsSchema = z.object({
  asset_id: z.string().uuid(),
  recommendation_type: z.enum(["maintenance", "optimization", "replacement", "similar_issues"]),
  limit: z.number().int().min(1).max(20).default(5),
  threshold: z.number().min(0).max(1).default(0.75),
})

// Schema for RAG context generation
const ragContextSchema = z.object({
  query: z.string().min(1, "Query is required"),
  asset_id: z.string().uuid().optional(),
  asset_types: z.array(z.string()).optional(),
  max_tokens: z.number().int().min(100).max(8000).default(4000),
  include_metadata: z.boolean().default(true),
})

// Create embeddings for assets
export async function createAssetEmbeddings(formData: z.infer<typeof createAssetEmbeddingsSchema>) {
  const supabase = await createServerSupabaseClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: "User not authenticated" }
    }

    const validatedData = createAssetEmbeddingsSchema.parse(formData)

    // Verify all assets belong to user
    const { data: assets, error: assetsError } = await supabase
      .from("assets")
      .select("id, name")
      .in("id", validatedData.asset_ids)
      .eq("user_id", user.id)

    if (assetsError || !assets || assets.length !== validatedData.asset_ids.length) {
      return { success: false, error: "Some assets not found or access denied" }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseServiceKey) {
      return { success: false, error: "Missing Supabase configuration" }
    }

    const assetEmbeddingSystem = new AssetEmbeddingSystem(supabaseUrl, supabaseServiceKey)

    // Create embeddings for all assets
    await assetEmbeddingSystem.createBulkAssetEmbeddings(validatedData.asset_ids, user.id, {
      includeProfile: validatedData.include_profile,
      includeLifecycleEvents: validatedData.include_lifecycle_events,
      includeInsights: validatedData.include_insights,
    })

    revalidatePath("/ai-suite/asset-intelligence")
    return {
      success: true,
      data: {
        message: `Successfully created embeddings for ${assets.length} assets`,
        asset_count: assets.length,
      },
    }
  } catch (error) {
    console.error("Error in createAssetEmbeddings:", error)
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return { success: false, error: "An unexpected error occurred" }
  }
}

// Search similar assets
export async function searchSimilarAssets(formData: z.infer<typeof assetSearchSchema>) {
  const supabase = await createServerSupabaseClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: "User not authenticated" }
    }

    const validatedData = assetSearchSchema.parse(formData)

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseServiceKey) {
      return { success: false, error: "Missing Supabase configuration" }
    }

    const assetEmbeddingSystem = new AssetEmbeddingSystem(supabaseUrl, supabaseServiceKey)

    const results = await assetEmbeddingSystem.searchSimilarAssets(validatedData.query, user.id, {
      assetTypes: validatedData.asset_types,
      categories: validatedData.categories,
      documentTypes: validatedData.document_types,
      limit: validatedData.limit,
      threshold: validatedData.threshold,
    })

    return { success: true, data: results }
  } catch (error) {
    console.error("Error in searchSimilarAssets:", error)
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return { success: false, error: "An unexpected error occurred" }
  }
}

// Get asset recommendations
export async function getAssetRecommendations(formData: z.infer<typeof assetRecommendationsSchema>) {
  const supabase = await createServerSupabaseClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: "User not authenticated" }
    }

    const validatedData = assetRecommendationsSchema.parse(formData)

    // Verify asset ownership
    const { data: asset, error: assetError } = await supabase
      .from("assets")
      .select("id")
      .eq("id", validatedData.asset_id)
      .eq("user_id", user.id)
      .single()

    if (assetError || !asset) {
      return { success: false, error: "Asset not found or access denied" }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseServiceKey) {
      return { success: false, error: "Missing Supabase configuration" }
    }

    const assetEmbeddingSystem = new AssetEmbeddingSystem(supabaseUrl, supabaseServiceKey)

    const recommendations = await assetEmbeddingSystem.getAssetRecommendations(validatedData.asset_id, user.id, {
      recommendationType: validatedData.recommendation_type,
      limit: validatedData.limit,
      threshold: validatedData.threshold,
    })

    return { success: true, data: recommendations }
  } catch (error) {
    console.error("Error in getAssetRecommendations:", error)
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return { success: false, error: "An unexpected error occurred" }
  }
}

// Generate RAG context for AI agents
export async function generateAssetRAGContext(formData: z.infer<typeof ragContextSchema>) {
  const supabase = await createServerSupabaseClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: "User not authenticated" }
    }

    const validatedData = ragContextSchema.parse(formData)

    // If asset_id is provided, verify ownership
    if (validatedData.asset_id) {
      const { data: asset, error: assetError } = await supabase
        .from("assets")
        .select("id")
        .eq("id", validatedData.asset_id)
        .eq("user_id", user.id)
        .single()

      if (assetError || !asset) {
        return { success: false, error: "Asset not found or access denied" }
      }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseServiceKey) {
      return { success: false, error: "Missing Supabase configuration" }
    }

    const assetEmbeddingSystem = new AssetEmbeddingSystem(supabaseUrl, supabaseServiceKey)

    const ragContext = await assetEmbeddingSystem.generateRAGContext(validatedData.query, user.id, {
      assetId: validatedData.asset_id,
      assetTypes: validatedData.asset_types,
      maxTokens: validatedData.max_tokens,
      includeMetadata: validatedData.include_metadata,
    })

    return { success: true, data: ragContext }
  } catch (error) {
    console.error("Error in generateAssetRAGContext:", error)
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return { success: false, error: "An unexpected error occurred" }
  }
}

// Auto-create embeddings when assets are created/updated
export async function autoCreateAssetEmbeddings(assetId: string, userId: string) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase configuration for auto-embedding")
      return
    }

    const assetEmbeddingSystem = new AssetEmbeddingSystem(supabaseUrl, supabaseServiceKey)

    await assetEmbeddingSystem.createAssetEmbeddings(assetId, userId, {
      includeProfile: true,
      includeLifecycleEvents: true,
      includeInsights: true,
    })

    console.log(`Auto-created embeddings for asset ${assetId}`)
  } catch (error) {
    console.error("Error in autoCreateAssetEmbeddings:", error)
    // Don't throw error to avoid breaking the main asset creation flow
  }
}

// Refresh embeddings for an asset (when data changes)
export async function refreshAssetEmbeddings(assetId: string) {
  const supabase = await createServerSupabaseClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: "User not authenticated" }
    }

    // Verify asset ownership
    const { data: asset, error: assetError } = await supabase
      .from("assets")
      .select("id, name")
      .eq("id", assetId)
      .eq("user_id", user.id)
      .single()

    if (assetError || !asset) {
      return { success: false, error: "Asset not found or access denied" }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseServiceKey) {
      return { success: false, error: "Missing Supabase configuration" }
    }

    // Delete existing embeddings for this asset
    await supabase.from("data_embeddings").delete().eq("user_id", user.id).like("metadata->>asset_id", assetId)

    // Create new embeddings
    const assetEmbeddingSystem = new AssetEmbeddingSystem(supabaseUrl, supabaseServiceKey)
    await assetEmbeddingSystem.createAssetEmbeddings(assetId, user.id)

    revalidatePath("/ai-suite/asset-intelligence")
    return {
      success: true,
      data: { message: `Successfully refreshed embeddings for ${asset.name}` },
    }
  } catch (error) {
    console.error("Error in refreshAssetEmbeddings:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}
