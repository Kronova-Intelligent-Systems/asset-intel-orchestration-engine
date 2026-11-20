"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { ClusteringSystem } from "@/lib/embeddings/clustering-system"
import type { ClusterResult } from "@/lib/types/search"

export async function clusterShipments({
  userId,
  clusterCount = 5,
  algorithm = "kmeans",
}: {
  userId: string
  clusterCount?: number
  algorithm?: string
}): Promise<ClusterResult[]> {
  const supabase = await createServerSupabaseClient()

  // Get environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase configuration")
  }

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

    // Get the shipment data for each embedding
    const shipmentIds = embeddings.map((item) => item.source_id)
    const { data: shipments, error: shipmentsError } = await supabase
      .from("shipping")
      .select("*")
      .in("id", shipmentIds)
      .eq("user_id", userId)

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

    // Initialize the clustering system
    const clusteringSystem = new ClusteringSystem()

    // Prepare data for clustering
    const vectors = embeddings.map((embedding) => ({
      id: embedding.source_id,
      vector: embedding.vector_data,
    }))

    // Perform clustering
    const clusterResults = await clusteringSystem.clusterVectors(vectors, {
      algorithm,
      clusterCount,
    })

    // Map cluster results to shipment data
    return clusterResults.map((cluster) => {
      const clusterShipments = cluster.points.map((point) => ({
        ...shipmentMap[point.id],
        similarity: point.distance,
      }))

      return {
        cluster_id: cluster.id,
        shipments: clusterShipments,
        centroid: cluster.centroid,
        size: clusterShipments.length,
        avg_distance: cluster.avgDistance,
        key_features: extractKeyFeatures(clusterShipments),
      }
    })
  } catch (error: any) {
    console.error("Error clustering shipments:", error)
    throw new Error(`Failed to cluster shipments: ${error.message}`)
  }
}

// Helper function to extract key features from a cluster of shipments
function extractKeyFeatures(shipments: any[]): string[] {
  if (!shipments || shipments.length === 0) {
    return []
  }

  // Count occurrences of various attributes
  const carriers: Record<string, number> = {}
  const originCountries: Record<string, number> = {}
  const destCountries: Record<string, number> = {}
  const statuses: Record<string, number> = {}
  const serviceLevels: Record<string, number> = {}

  shipments.forEach((shipment) => {
    // Count carriers
    if (shipment.carrier) {
      carriers[shipment.carrier] = (carriers[shipment.carrier] || 0) + 1
    }

    // Count origin countries
    if (shipment.origin_address?.country) {
      originCountries[shipment.origin_address.country] = (originCountries[shipment.origin_address.country] || 0) + 1
    }

    // Count destination countries
    if (shipment.destination_address?.country) {
      destCountries[shipment.destination_address.country] =
        (destCountries[shipment.destination_address.country] || 0) + 1
    }

    // Count statuses
    if (shipment.status) {
      statuses[shipment.status] = (statuses[shipment.status] || 0) + 1
    }

    // Count service levels
    if (shipment.service_level) {
      serviceLevels[shipment.service_level] = (serviceLevels[shipment.service_level] || 0) + 1
    }
  })

  // Find the most common values
  const features: string[] = []

  // Add most common carrier
  const topCarrier = Object.entries(carriers).sort((a, b) => b[1] - a[1])[0]
  if (topCarrier && topCarrier[1] > shipments.length * 0.5) {
    features.push(`Carrier: ${topCarrier[0]}`)
  }

  // Add most common origin country
  const topOrigin = Object.entries(originCountries).sort((a, b) => b[1] - a[1])[0]
  if (topOrigin && topOrigin[1] > shipments.length * 0.5) {
    features.push(`From: ${topOrigin[0]}`)
  }

  // Add most common destination country
  const topDest = Object.entries(destCountries).sort((a, b) => b[1] - a[1])[0]
  if (topDest && topDest[1] > shipments.length * 0.5) {
    features.push(`To: ${topDest[0]}`)
  }

  // Add most common status
  const topStatus = Object.entries(statuses).sort((a, b) => b[1] - a[1])[0]
  if (topStatus && topStatus[1] > shipments.length * 0.5) {
    features.push(`Status: ${topStatus[0]}`)
  }

  // Add most common service level
  const topService = Object.entries(serviceLevels).sort((a, b) => b[1] - a[1])[0]
  if (topService && topService[1] > shipments.length * 0.5) {
    features.push(`Service: ${topService[0]}`)
  }

  // Add weight range if applicable
  const weights = shipments.filter((s) => s.weight !== null && s.weight !== undefined).map((s) => s.weight)

  if (weights.length > 0) {
    const minWeight = Math.min(...weights)
    const maxWeight = Math.max(...weights)
    if (maxWeight - minWeight < 5) {
      features.push(`Weight: ~${Math.round((minWeight + maxWeight) / 2)}kg`)
    } else if (maxWeight > 20) {
      features.push(`Heavy (${minWeight}-${maxWeight}kg)`)
    }
  }

  return features
}
