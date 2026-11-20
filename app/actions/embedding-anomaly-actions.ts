"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { AnomalyDetectionSystem } from "@/lib/embeddings/anomaly-detection-system"
import type { AnomalyResult } from "@/lib/types/search"
import { addDays } from "date-fns"

export async function detectAnomalies({
  userId,
  threshold = 0.8,
  method = "isolation-forest",
  timeRange = "all",
}: {
  userId: string
  threshold?: number
  method?: string
  timeRange?: string
}): Promise<AnomalyResult[]> {
  const supabase = await createServerSupabaseClient()

  try {
    // Get all shipping embeddings for the user
    const { data: embeddings, error: embeddingsError } = await supabase
      .from("data_embeddings")
      .select("id, source_id, vector_data")
      .eq("source_type", "shipping")
      .eq("user_id", userId)

    if (embeddingsError) {
      throw new Error(`Error fetching embeddings: ${embeddingsError.message}`)
    }

    if (!embeddings || embeddings.length === 0) {
      throw new Error("No shipping embeddings found for this user")
    }

    // Apply time range filter if specified
    let startDate: Date | null = null
    if (timeRange !== "all") {
      const days = Number.parseInt(timeRange)
      startDate = addDays(new Date(), -days)
    }

    // Get the shipment data for each embedding
    const shipmentIds = embeddings.map((item) => item.source_id)
    let query = supabase.from("shipping").select("*").in("id", shipmentIds).eq("user_id", userId)

    if (startDate) {
      query = query.gte("created_at", startDate.toISOString())
    }

    const { data: shipments, error: shipmentsError } = await query

    if (shipmentsError) {
      throw new Error(`Error fetching shipments: ${shipmentsError.message}`)
    }

    // Create a map of shipment data by ID
    const shipmentMap = shipments.reduce(
      (map, shipment) => {
        map[shipment.id] = shipment
        return map
      },
      {} as Record<string, any>,
    )

    // Filter embeddings to only include those with matching shipments
    const filteredEmbeddings = embeddings.filter((embedding) => shipmentMap[embedding.source_id])

    // Initialize the anomaly detection system
    const anomalyDetectionSystem = new AnomalyDetectionSystem()

    // Prepare data for anomaly detection
    const vectors = filteredEmbeddings.map((embedding) => ({
      id: embedding.source_id,
      vector: embedding.vector_data,
    }))

    // Perform anomaly detection
    const anomalyResults = await anomalyDetectionSystem.detectAnomalies(vectors, {
      method,
      threshold,
    })

    // Map anomaly results to shipment data
    return anomalyResults
      .filter((result) => result.is_anomaly)
      .map((result) => ({
        shipment: shipmentMap[result.id],
        anomaly_score: result.anomaly_score,
        anomaly_type: result.anomaly_type,
        explanation: result.explanation,
        threshold: result.threshold,
        is_anomaly: result.is_anomaly,
      }))
  } catch (error: any) {
    console.error("Error detecting anomalies:", error)
    throw new Error(`Failed to detect anomalies: ${error.message}`)
  }
}
