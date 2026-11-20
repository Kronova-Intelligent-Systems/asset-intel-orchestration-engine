"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { EmbeddingSystem } from "@/lib/embeddings/embedding-system"
import type { ShipmentSearchResult } from "@/lib/types/search"

export async function searchSimilarShipments({
  userId,
  query,
  searchType = "text",
  threshold = 0.7,
  limit = 10,
}: {
  userId: string
  query: string
  searchType?: "text" | "id"
  threshold?: number
  limit?: number
}): Promise<ShipmentSearchResult[]> {
  const supabase = await createServerSupabaseClient()

  // Get environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase configuration")
  }

  try {
    // If searching by tracking number, get the embedding for that shipment
    if (searchType === "id") {
      const { data: shipment, error: shipmentError } = await supabase
        .from("shipping")
        .select("*")
        .eq("tracking_number", query)
        .eq("user_id", userId)
        .single()

      if (shipmentError || !shipment) {
        throw new Error(`Shipment with tracking number ${query} not found`)
      }

      // Get the embedding for this shipment
      const { data: embedding, error: embeddingError } = await supabase
        .from("data_embeddings")
        .select("vector_data")
        .eq("source_id", shipment.id)
        .eq("source_type", "shipping")
        .eq("user_id", userId)
        .single()

      if (embeddingError || !embedding) {
        throw new Error(`No embedding found for shipment ${query}`)
      }

      // Use the embedding to find similar shipments
      const { data: similarEmbeddings, error: similarError } = await supabase.rpc("match_embeddings", {
        query_embedding: embedding.vector_data,
        match_threshold: threshold,
        match_count: limit,
        user_id: userId,
      })

      if (similarError) {
        throw new Error(`Error finding similar embeddings: ${similarError.message}`)
      }

      // Get the shipment data for each similar embedding
      const shipmentIds = similarEmbeddings.map((item: any) => item.source_id)
      const { data: shipments, error: shipmentsError } = await supabase
        .from("shipping")
        .select("*")
        .in("id", shipmentIds)
        .eq("user_id", userId)

      if (shipmentsError) {
        throw new Error(`Error fetching similar shipments: ${shipmentsError.message}`)
      }

      // Combine the similarity scores with the shipment data
      return shipments
        .map((shipment) => {
          const matchingEmbedding = similarEmbeddings.find((e: any) => e.source_id === shipment.id)
          return {
            ...shipment,
            similarity: matchingEmbedding ? matchingEmbedding.similarity : 0,
          }
        })
        .sort((a, b) => b.similarity - a.similarity)
    } else {
      // Text search - generate embedding for the query
      const embeddingSystem = new EmbeddingSystem(supabaseUrl, supabaseServiceKey)

      // Generate embedding for the query
      const embeddingResponse = await embeddingSystem.generateEmbedding(query)

      // Use the embedding to find similar shipments
      const { data: similarEmbeddings, error: similarError } = await supabase.rpc("match_embeddings", {
        query_embedding: embeddingResponse,
        match_threshold: threshold,
        match_count: limit,
        user_id: userId,
      })

      if (similarError) {
        throw new Error(`Error finding similar embeddings: ${similarError.message}`)
      }

      // Get the shipment data for each similar embedding
      const shipmentIds = similarEmbeddings.map((item: any) => item.source_id)
      const { data: shipments, error: shipmentsError } = await supabase
        .from("shipping")
        .select("*")
        .in("id", shipmentIds)
        .eq("user_id", userId)

      if (shipmentsError) {
        throw new Error(`Error fetching similar shipments: ${shipmentsError.message}`)
      }

      // Combine the similarity scores with the shipment data
      return shipments
        .map((shipment) => {
          const matchingEmbedding = similarEmbeddings.find((e: any) => e.source_id === shipment.id)
          return {
            ...shipment,
            similarity: matchingEmbedding ? matchingEmbedding.similarity : 0,
          }
        })
        .sort((a, b) => b.similarity - a.similarity)
    }
  } catch (error: any) {
    console.error("Error searching similar shipments:", error)
    throw new Error(`Failed to search similar shipments: ${error.message}`)
  }
}
