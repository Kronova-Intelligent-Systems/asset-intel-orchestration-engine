import { EmbeddingSystem } from "./embedding-system"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Asset, AssetLifecycleEvent, AssetIntelligenceInsight } from "@/lib/schemas/asset-intelligence"

export interface AssetDocument {
  id: string
  content: string
  metadata: {
    asset_id: string
    asset_name: string
    asset_type: string
    category?: string
    document_type:
      | "asset_profile"
      | "lifecycle_event"
      | "maintenance_log"
      | "compliance_report"
      | "iot_data"
      | "insight"
    created_at: string
    [key: string]: any
  }
}

export interface AssetSearchResult {
  id: string
  content: string
  metadata: Record<string, any>
  similarity: number
  asset_id: string
  asset_name: string
  document_type: string
}

export class AssetEmbeddingSystem extends EmbeddingSystem {
  private db?: Awaited<ReturnType<typeof createServerSupabaseClient>>

  constructor(supabaseUrl: string, supabaseKey: string, embeddingModel = "text-embedding-ada-002") {
    super(supabaseUrl, supabaseKey, embeddingModel)
  }

  private async getDb() {
    this.db ??= await createServerSupabaseClient()
    return this.db
  }

  // Create embeddings for asset data
  async createAssetEmbeddings(
    assetId: string,
    userId: string,
    options: {
      includeProfile?: boolean
      includeLifecycleEvents?: boolean
      includeInsights?: boolean
      includeIoTData?: boolean
    } = {},
  ): Promise<void> {
    const {
      includeProfile = true,
      includeLifecycleEvents = true,
      includeInsights = true,
      includeIoTData = false,
    } = options

    // Get asset data
    const { data: asset, error: assetError } = await (await this.getDb())
      .from("assets")
      .select("*")
      .eq("id", assetId)
      .eq("user_id", userId)
      .single()

    if (assetError || !asset) {
      throw new Error("Asset not found or access denied")
    }

    const documents: AssetDocument[] = []

    // Create asset profile document
    if (includeProfile) {
      const profileContent = this.generateAssetProfileContent(asset)
      documents.push({
        id: `asset-profile-${assetId}`,
        content: profileContent,
        metadata: {
          asset_id: assetId,
          asset_name: asset.name,
          asset_type: asset.asset_type,
          category: asset.category,
          document_type: "asset_profile",
          created_at: asset.created_at,
          status: asset.status,
          current_value: asset.current_value,
          location_id: asset.location_id,
          has_iot: !!asset.iot_sensor_id,
        },
      })
    }

    // Create lifecycle event documents
    if (includeLifecycleEvents) {
      const { data: events } = await (await this.getDb())
        .from("asset_lifecycle_events")
        .select("*")
        .eq("asset_id", assetId)
        .eq("user_id", userId)
        .order("event_date", { ascending: false })

      if (events) {
        for (const event of events) {
          const eventContent = this.generateLifecycleEventContent(event, asset)
          documents.push({
            id: `lifecycle-event-${event.id}`,
            content: eventContent,
            metadata: {
              asset_id: assetId,
              asset_name: asset.name,
              asset_type: asset.asset_type,
              category: asset.category,
              document_type: "lifecycle_event",
              created_at: event.created_at,
              event_type: event.event_type,
              event_status: event.event_status,
              event_date: event.event_date,
              cost: event.cost,
              performed_by: event.performed_by,
            },
          })
        }
      }
    }

    // Create insight documents
    if (includeInsights) {
      const { data: insights } = await (await this.getDb())
        .from("asset_intelligence_insights")
        .select("*")
        .eq("asset_id", assetId)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })

      if (insights) {
        for (const insight of insights) {
          const insightContent = this.generateInsightContent(insight, asset)
          documents.push({
            id: `insight-${insight.id}`,
            content: insightContent,
            metadata: {
              asset_id: assetId,
              asset_name: asset.name,
              asset_type: asset.asset_type,
              category: asset.category,
              document_type: "insight",
              created_at: insight.created_at,
              insight_type: insight.insight_type,
              priority: insight.priority,
              status: insight.status,
              confidence_score: insight.confidence_score,
            },
          })
        }
      }
    }

    // Create embeddings for all documents
    if (documents.length > 0) {
      await this.createEmbeddings(
        documents,
        userId,
        `Asset Intelligence - ${asset.name}`,
        `Comprehensive asset data for ${asset.name} (${asset.asset_type})`,
      )
    }
  }

  // Bulk create embeddings for multiple assets
  async createBulkAssetEmbeddings(
    assetIds: string[],
    userId: string,
    options: {
      includeProfile?: boolean
      includeLifecycleEvents?: boolean
      includeInsights?: boolean
      batchSize?: number
    } = {},
  ): Promise<void> {
    const { batchSize = 5 } = options

    // Process assets in batches to avoid overwhelming the system
    for (let i = 0; i < assetIds.length; i += batchSize) {
      const batch = assetIds.slice(i, i + batchSize)

      const promises = batch.map((assetId) => this.createAssetEmbeddings(assetId, userId, options))

      await Promise.all(promises)

      // Add delay between batches
      if (i + batchSize < assetIds.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }
  }

  // Search for similar assets based on query
  async searchSimilarAssets(
    query: string,
    userId: string,
    options: {
      assetTypes?: string[]
      categories?: string[]
      documentTypes?: string[]
      limit?: number
      threshold?: number
    } = {},
  ): Promise<AssetSearchResult[]> {
    const { assetTypes = [], categories = [], documentTypes = [], limit = 10, threshold = 0.7 } = options

    // Generate embedding for the query
    const queryEmbedding = await this.generateEmbedding(query)

    // Search for similar documents
    const { data, error } = await (await this.getDb()).rpc("match_embeddings", {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: limit * 2, // Get more results to filter
      user_id: userId,
    })

    if (error) {
      throw new Error("Failed to search similar assets: " + error.message)
    }

    // Filter and format results
    const results = data
      .filter((item: any) => {
        const metadata = item.metadata

        // Filter by asset type
        if (assetTypes.length > 0 && !assetTypes.includes(metadata.asset_type)) {
          return false
        }

        // Filter by category
        if (categories.length > 0 && !categories.includes(metadata.category)) {
          return false
        }

        // Filter by document type
        if (documentTypes.length > 0 && !documentTypes.includes(metadata.document_type)) {
          return false
        }

        return true
      })
      .slice(0, limit)
      .map((item: any) => ({
        id: item.id,
        content: item.content,
        metadata: item.metadata,
        similarity: item.similarity,
        asset_id: item.metadata.asset_id,
        asset_name: item.metadata.asset_name,
        document_type: item.metadata.document_type,
      }))

    return results
  }

  // Get asset recommendations based on similar assets
  async getAssetRecommendations(
    assetId: string,
    userId: string,
    options: {
      recommendationType: "maintenance" | "optimization" | "replacement" | "similar_issues"
      limit?: number
      threshold?: number
    },
  ): Promise<AssetSearchResult[]> {
    const { recommendationType, limit = 5, threshold = 0.75 } = options

    // Get the target asset
    const { data: asset, error: assetError } = await (await this.getDb())
      .from("assets")
      .select("*")
      .eq("id", assetId)
      .eq("user_id", userId)
      .single()

    if (assetError || !asset) {
      throw new Error("Asset not found")
    }

    let searchQuery = ""
    let documentTypes: string[] = []

    switch (recommendationType) {
      case "maintenance":
        searchQuery = `${asset.asset_type} maintenance schedule repair history preventive maintenance`
        documentTypes = ["lifecycle_event", "insight"]
        break
      case "optimization":
        searchQuery = `${asset.asset_type} cost optimization utilization efficiency performance improvement`
        documentTypes = ["insight", "asset_profile"]
        break
      case "replacement":
        searchQuery = `${asset.asset_type} replacement lifecycle end-of-life depreciation high maintenance cost`
        documentTypes = ["insight", "lifecycle_event"]
        break
      case "similar_issues":
        searchQuery = `${asset.asset_type} ${asset.category} issues problems failures repairs`
        documentTypes = ["lifecycle_event", "insight"]
        break
    }

    return await this.searchSimilarAssets(searchQuery, userId, {
      assetTypes: [asset.asset_type],
      categories: asset.category ? [asset.category] : [],
      documentTypes,
      limit,
      threshold,
    })
  }

  // Generate RAG context for AI agents
  async generateRAGContext(
    query: string,
    userId: string,
    options: {
      assetId?: string
      assetTypes?: string[]
      maxTokens?: number
      includeMetadata?: boolean
    } = {},
  ): Promise<{
    context: string
    sources: AssetSearchResult[]
    tokenCount: number
  }> {
    const { assetId, assetTypes = [], maxTokens = 4000, includeMetadata = true } = options

    let searchResults: AssetSearchResult[]

    if (assetId) {
      // Search within specific asset context
      searchResults = await this.searchSimilarAssets(query, userId, {
        limit: 10,
        threshold: 0.6,
      })
      // Filter to only include the specific asset
      searchResults = searchResults.filter((result) => result.asset_id === assetId)
    } else {
      // General search across all assets
      searchResults = await this.searchSimilarAssets(query, userId, {
        assetTypes,
        limit: 15,
        threshold: 0.7,
      })
    }

    // Build context string
    let context = ""
    let tokenCount = 0
    const sources: AssetSearchResult[] = []

    for (const result of searchResults) {
      let contextEntry = ""

      if (includeMetadata) {
        contextEntry += `Asset: ${result.asset_name} (${result.metadata.asset_type})\n`
        contextEntry += `Document Type: ${result.document_type}\n`
        contextEntry += `Similarity: ${(result.similarity * 100).toFixed(1)}%\n`
        contextEntry += `Content: ${result.content}\n\n`
      } else {
        contextEntry = result.content + "\n\n"
      }

      // Rough token estimation (1 token ≈ 4 characters)
      const entryTokens = Math.ceil(contextEntry.length / 4)

      if (tokenCount + entryTokens > maxTokens) {
        break
      }

      context += contextEntry
      tokenCount += entryTokens
      sources.push(result)
    }

    return {
      context: context.trim(),
      sources,
      tokenCount,
    }
  }

  // Private helper methods
  private generateAssetProfileContent(asset: Asset): string {
    const parts = [`Asset Name: ${asset.name}`, `Asset Type: ${asset.asset_type}`, `Status: ${asset.status}`]

    if (asset.description) {
      parts.push(`Description: ${asset.description}`)
    }

    if (asset.category) {
      parts.push(`Category: ${asset.category}`)
    }

    if (asset.current_value) {
      parts.push(`Current Value: $${asset.current_value.toLocaleString()}`)
    }

    if (asset.purchase_cost) {
      parts.push(`Purchase Cost: $${asset.purchase_cost.toLocaleString()}`)
    }

    if (asset.purchase_date) {
      parts.push(`Purchase Date: ${asset.purchase_date}`)
    }

    if (asset.location_id) {
      parts.push(`Location: ${asset.location_id}`)
    }

    if (asset.iot_sensor_id) {
      parts.push(`IoT Enabled: Yes (Sensor ID: ${asset.iot_sensor_id})`)
    }

    // Include specifications
    if (Object.keys(asset.specifications).length > 0) {
      parts.push(`Specifications: ${JSON.stringify(asset.specifications, null, 2)}`)
    }

    // Include ESG metrics
    if (Object.keys(asset.esg_metrics).length > 0) {
      parts.push(`ESG Metrics: ${JSON.stringify(asset.esg_metrics, null, 2)}`)
    }

    // Include compliance data
    if (Object.keys(asset.compliance_data).length > 0) {
      parts.push(`Compliance Data: ${JSON.stringify(asset.compliance_data, null, 2)}`)
    }

    return parts.join("\n")
  }

  private generateLifecycleEventContent(event: AssetLifecycleEvent, asset: Asset): string {
    const parts = [
      `Asset: ${asset.name} (${asset.asset_type})`,
      `Event Type: ${event.event_type}`,
      `Event Status: ${event.event_status}`,
      `Event Date: ${event.event_date}`,
    ]

    if (event.description) {
      parts.push(`Description: ${event.description}`)
    }

    if (event.cost) {
      parts.push(`Cost: $${event.cost.toLocaleString()}`)
    }

    if (event.performed_by) {
      parts.push(`Performed By: ${event.performed_by}`)
    }

    if (event.location) {
      parts.push(`Location: ${JSON.stringify(event.location)}`)
    }

    if (Object.keys(event.documentation).length > 0) {
      parts.push(`Documentation: ${JSON.stringify(event.documentation, null, 2)}`)
    }

    return parts.join("\n")
  }

  private generateInsightContent(insight: AssetIntelligenceInsight, asset: Asset): string {
    const parts = [
      `Asset: ${asset.name} (${asset.asset_type})`,
      `Insight Type: ${insight.insight_type}`,
      `Priority: ${insight.priority}`,
      `Confidence Score: ${(insight.confidence_score * 100).toFixed(1)}%`,
      `Status: ${insight.status}`,
    ]

    // Include insight data
    if (Object.keys(insight.insight_data).length > 0) {
      parts.push(`Analysis: ${JSON.stringify(insight.insight_data, null, 2)}`)
    }

    // Include recommendations
    if (insight.recommendations.length > 0) {
      parts.push(`Recommendations: ${JSON.stringify(insight.recommendations, null, 2)}`)
    }

    return parts.join("\n")
  }
}
