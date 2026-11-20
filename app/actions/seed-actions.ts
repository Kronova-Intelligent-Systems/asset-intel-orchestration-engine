"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { v4 as uuidv4 } from "uuid"
import { revalidatePath } from "next/cache"
import { generateReusablePackage, generateShippingData } from "@/lib/seed/shipping-seed"
import type { Database } from "@/lib/supabase/database.types"
import { checkColumnExists, ensureShippingSchemaExists } from "@/lib/supabase/schema-helpers"

// Define types based on the database schema
type ShippingInsert = Database["public"]["Tables"]["shipping"]["Insert"]
type ReusablePackageInsert = Database["public"]["Tables"]["reusable_packages"]["Insert"]
type DataEmbeddingInsert = Database["public"]["Tables"]["data_embeddings"]["Insert"]

// Function to generate a random embedding vector with 1536 dimensions
function generateRandomEmbedding(dimensions = 1536): number[] {
  const embedding = []
  for (let i = 0; i < dimensions; i++) {
    // Generate values between -1 and 1, which is typical for normalized embeddings
    embedding.push(Math.random() * 2 - 1)
  }
  return embedding
}

// Function to generate a random date within the last year
function randomDate(start = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), end = new Date()): string {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString()
}

// Update the createShippingDescription function to include IoT sensor data
function createShippingDescription(shippingData: ShippingInsert): string {
  const description = `
    Tracking Number: ${shippingData.tracking_number}
    Status: ${shippingData.status}
    Carrier: ${shippingData.carrier}
    Origin: ${shippingData.origin_address?.street}, ${shippingData.origin_address?.city}, ${shippingData.origin_address?.state}, ${shippingData.origin_address?.country}
    Destination: ${shippingData.destination_address?.street}, ${shippingData.destination_address?.city}, ${shippingData.destination_address?.state}, ${shippingData.destination_address?.country}
    Weight: ${shippingData.weight} kg
    Shipping Date: ${shippingData.shipping_date}
    Estimated Delivery: ${shippingData.estimated_delivery}
    ${shippingData.actual_delivery ? `Actual Delivery: ${shippingData.actual_delivery}` : ""}
  `.trim()

  return description
}

// Server action to seed the database with mock shipment embeddings
export async function seedShipmentEmbeddings(userId: string, count = 50) {
  const supabase = await createServerSupabaseClient()

  // Use the provided userId or fall back to the environment variable
  const targetUserId = userId || process.env.SEED_USER_ID || "00000000-0000-0000-0000-000000000000"

  console.log(`Starting to seed ${count} shipment embeddings for user ${targetUserId}...`)

  const records: DataEmbeddingInsert[] = []

  for (let i = 0; i < count; i++) {
    const shippingData = generateShippingData()
    const shippingText = createShippingDescription(shippingData)
    const embedding = generateRandomEmbedding(1536)

    records.push({
      id: uuidv4(),
      name: `Shipment ${shippingData.tracking_number}`,
      description: `Shipment from ${shippingData.origin_address?.country} to ${shippingData.destination_address?.country}`,
      source_type: "shipping",
      source_id: shippingData.tracking_number,
      embedding_model: "text-embedding-ada-002",
      vector_data: embedding,
      metadata: {
        content: shippingText,
        shipping_data: shippingData,
      },
      user_id: targetUserId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }

  // Insert records in batches to avoid payload size limitations
  const batchSize = 10
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize)
    const { error } = await supabase.from("data_embeddings").insert(batch)

    if (error) {
      console.error(`Error inserting batch ${i / batchSize + 1}:`, error)
      throw new Error(`Failed to seed embeddings: ${error.message}`)
    }
  }

  revalidatePath("/ai-suite/embeddings")
  return { success: true, count }
}

// Function to seed reusable packages
export async function seedReusablePackages(count = 20) {
  const supabase = await createServerSupabaseClient()

  try {
    // Check if the reusable_packages table has the required columns using direct SQL
    const hasCurrentShipmentId = await checkColumnExists("reusable_packages", "current_shipment_id")
    const hasShipmentHistory = await checkColumnExists("reusable_packages", "shipment_history")

    // If the columns don't exist, add them
    if (!hasCurrentShipmentId || !hasShipmentHistory) {
      const { error } = await supabase.sql(`
        DO $$
        BEGIN
          -- Add current_shipment_id if it doesn't exist
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'reusable_packages' 
            AND column_name = 'current_shipment_id'
          ) THEN
            ALTER TABLE public.reusable_packages 
            ADD COLUMN current_shipment_id uuid REFERENCES public.shipping(id) NULL;
          END IF;
          
          -- Add shipment_history if it doesn't exist
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'reusable_packages' 
            AND column_name = 'shipment_history'
          ) THEN
            ALTER TABLE public.reusable_packages 
            ADD COLUMN shipment_history uuid[] DEFAULT '{}';
          END IF;
        END $$;
      `)

      if (error) {
        console.error("Error adding columns to reusable_packages:", error)
      }
    }

    // Generate packages
    const packages = Array.from({ length: count }, (_, i) => generateReusablePackage(i))

    // Insert packages
    const { data, error } = await supabase.from("reusable_packages").insert(packages).select()

    if (error) {
      console.error("Error seeding reusable packages:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/shipping")
    return { success: true, data, count: data.length }
  } catch (error) {
    console.error("Error in seedReusablePackages:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}

// Function to seed shipping records
export async function seedShippingRecords(count = 30) {
  const supabase = await createServerSupabaseClient()

  try {
    // Check if the shipping table has the package_ids column using direct SQL
    const hasPackageIds = await checkColumnExists("shipping", "package_ids")

    // If the column doesn't exist, add it
    if (!hasPackageIds) {
      const { error } = await supabase.sql(`
        ALTER TABLE public.shipping 
        ADD COLUMN IF NOT EXISTS package_ids uuid[] DEFAULT NULL;
      `)

      if (error) {
        console.error("Error adding package_ids column to shipping:", error)
        return { success: false, error: "Failed to add package_ids column to shipping table" }
      }
    }

    // Get available packages
    const { data: availablePackages, error: packagesError } = await supabase
      .from("reusable_packages")
      .select("id")
      .eq("status", "available")

    if (packagesError) {
      console.error("Error fetching available packages:", packagesError)
      return { success: false, error: packagesError.message }
    }

    const availablePackageIds = availablePackages.map((pkg) => pkg.id)

    // Generate shipping records
    const shippingRecords = Array.from({ length: count }, () => generateShippingData(availablePackageIds))

    // Insert shipping records in batches to avoid potential issues
    const batchSize = 5
    const results = []

    for (let i = 0; i < shippingRecords.length; i += batchSize) {
      const batch = shippingRecords.slice(i, i + batchSize)
      const { data, error } = await supabase.from("shipping").insert(batch).select()

      if (error) {
        console.error(`Error inserting shipping batch ${i / batchSize + 1}:`, error)
        return { success: false, error: error.message }
      }

      if (data) {
        results.push(...data)
      }
    }

    revalidatePath("/shipping")
    return { success: true, data: results, count: results.length }
  } catch (error) {
    console.error("Error in seedShippingRecords:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}

// Comprehensive function to seed all shipping-related data
export async function seedShippingDashboard(packageCount = 20, shippingCount = 30) {
  try {
    // First ensure all required tables and views exist
    const schemaExists = await ensureShippingSchemaExists()

    if (!schemaExists) {
      return {
        success: false,
        error: "Failed to ensure database schema exists. Please check your database setup.",
      }
    }

    // First seed packages
    const packagesResult = await seedReusablePackages(packageCount)
    if (!packagesResult.success) {
      return packagesResult
    }

    // Then seed shipping records
    const shippingResult = await seedShippingRecords(shippingCount)
    if (!shippingResult.success) {
      return shippingResult
    }

    revalidatePath("/shipping")
    return {
      success: true,
      packages: packagesResult.count,
      shipments: shippingResult.count,
    }
  } catch (error) {
    console.error("Error in seedShippingDashboard:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}

export async function seedAssetEmbeddings(userId: string, count = 50) {
  const supabase = await createServerSupabaseClient()

  const targetUserId = userId || process.env.SEED_USER_ID || "00000000-0000-0000-0000-000000000000"

  console.log(`Starting to seed ${count} asset embeddings for user ${targetUserId}...`)

  const records: DataEmbeddingInsert[] = []

  // Asset types and categories
  const assetTypes = ["equipment", "vehicle", "container", "tool", "device"]
  const categories = ["manufacturing", "logistics", "maintenance", "automation", "monitoring"]
  const statuses = ["active", "idle", "maintenance", "decommissioned"]

  for (let i = 0; i < count; i++) {
    const assetType = assetTypes[Math.floor(Math.random() * assetTypes.length)]
    const category = categories[Math.floor(Math.random() * categories.length)]
    const status = statuses[Math.floor(Math.random() * statuses.length)]
    const assetId = `ASSET-${Math.random().toString(36).substring(2, 9).toUpperCase()}`

    const assetData = {
      asset_id: assetId,
      name: `${assetType.charAt(0).toUpperCase() + assetType.slice(1)} ${i + 1}`,
      asset_type: assetType,
      category: category,
      status: status,
      description: `Enterprise ${assetType} for ${category} operations`,
      purchase_date: randomDate(new Date(2020, 0, 1), new Date()),
      purchase_cost: Math.floor(Math.random() * 50000) + 5000,
      current_value: Math.floor(Math.random() * 40000) + 3000,
      operational_status: status === "active" ? "operational" : status === "idle" ? "standby" : "offline",
      battery_level: status === "active" ? Math.floor(Math.random() * 40) + 60 : Math.floor(Math.random() * 30) + 10,
      total_runtime_hours: Math.floor(Math.random() * 10000) + 100,
      last_maintenance_date: randomDate(new Date(2024, 0, 1), new Date()),
      next_maintenance_date: randomDate(new Date(), new Date(2025, 11, 31)),
      location: {
        facility: `Facility ${Math.floor(Math.random() * 5) + 1}`,
        zone: `Zone ${String.fromCharCode(65 + Math.floor(Math.random() * 4))}`,
        latitude: (Math.random() * 180 - 90).toFixed(6),
        longitude: (Math.random() * 360 - 180).toFixed(6),
      },
      specifications: {
        manufacturer: ["Acme Corp", "TechPro", "IndustryMax", "AutoSystems"][Math.floor(Math.random() * 4)],
        model: `Model-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        serial_number: `SN${Math.random().toString(36).substring(2, 11).toUpperCase()}`,
        weight_kg: Math.floor(Math.random() * 5000) + 100,
        dimensions: {
          length: Math.floor(Math.random() * 500) + 50,
          width: Math.floor(Math.random() * 300) + 30,
          height: Math.floor(Math.random() * 400) + 40,
        },
      },
      sensors: ["temperature", "pressure", "vibration", "gps", "fuel_level"],
      esg_metrics: {
        carbon_footprint_kg: Math.floor(Math.random() * 1000),
        energy_consumption_kwh: Math.floor(Math.random() * 5000),
        recyclability_score: Math.floor(Math.random() * 100),
      },
    }

    const assetText = `
      Asset ID: ${assetData.asset_id}
      Name: ${assetData.name}
      Type: ${assetData.asset_type}
      Category: ${assetData.category}
      Status: ${assetData.status}
      Description: ${assetData.description}
      Purchase Date: ${assetData.purchase_date}
      Purchase Cost: $${assetData.purchase_cost}
      Current Value: $${assetData.current_value}
      Operational Status: ${assetData.operational_status}
      Battery Level: ${assetData.battery_level}%
      Runtime Hours: ${assetData.total_runtime_hours}
      Location: ${assetData.location.facility}, ${assetData.location.zone}
      Manufacturer: ${assetData.specifications.manufacturer}
      Model: ${assetData.specifications.model}
      Serial Number: ${assetData.specifications.serial_number}
    `.trim()

    const embedding = generateRandomEmbedding(1536)

    records.push({
      id: uuidv4(),
      name: assetData.name,
      description: assetData.description,
      source_type: "asset",
      source_id: assetData.asset_id,
      embedding_model: "text-embedding-ada-002",
      vector_data: embedding,
      metadata: {
        content: assetText,
        asset_data: assetData,
      },
      user_id: targetUserId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }

  // Insert records in batches
  const batchSize = 10
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize)
    const { error } = await supabase.from("data_embeddings").insert(batch)

    if (error) {
      console.error(`Error inserting batch ${i / batchSize + 1}:`, error)
      throw new Error(`Failed to seed embeddings: ${error.message}`)
    }
  }

  revalidatePath("/ai-suite/embeddings")
  return { success: true, count }
}
