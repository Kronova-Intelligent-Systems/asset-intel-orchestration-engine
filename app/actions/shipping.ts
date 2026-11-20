"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import type { z } from "zod"
import type { Database } from "@/lib/supabase/database.types"
import { shippingSchema, reusablePackageSchema } from "@/lib/schemas/shipping"
import { createUpsShipment } from "@/lib/shipping-carriers/ups"
import { createFedexShipment } from "@/lib/shipping-carriers/fedex"

// Import the shipping and reusable package schemas
// import { shippingSchema, reusablePackageSchema } from "@/lib/schemas/shipping"

// Define types based on the database schema
type ShippingRow = Database["public"]["Tables"]["shipping"]["Row"]
type ShippingInsert = Database["public"]["Tables"]["shipping"]["Insert"]
type ReusablePackageRow = Database["public"]["Tables"]["reusable_packages"]["Row"]
type ReusablePackageInsert = Database["public"]["Tables"]["reusable_packages"]["Insert"]
type ShippingAnalyticsRow = Database["public"]["Views"]["shipping_analytics"]["Row"]
type PackageUtilizationRow = Database["public"]["Views"]["package_utilization"]["Row"]

// Fetch all shipping records for a user
export async function getShippingData() {
  const supabase = await createServerSupabaseClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect("/login")
    }

    // Fetch shipping data
    const { data: shippingData, error: shippingError } = await supabase
      .from("shipping")
      .select("*")
      .order("created_at", { ascending: false })

    if (shippingError) {
      console.error("Error fetching shipping data:", shippingError)
      return { success: false, error: shippingError.message }
    }

    return { success: true, data: shippingData as ShippingRow[] }
  } catch (error) {
    console.error("Error in getShippingData:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}

// Fetch all reusable packages
export async function getReusablePackages() {
  const supabase = await createServerSupabaseClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect("/login")
    }

    // Fetch reusable packages data
    const { data: packagesData, error: packagesError } = await supabase
      .from("reusable_packages")
      .select("*")
      .order("created_at", { ascending: false })

    if (packagesError) {
      console.error("Error fetching reusable packages:", packagesError)
      return { success: false, error: packagesError.message }
    }

    return { success: true, data: packagesData as ReusablePackageRow[] }
  } catch (error) {
    console.error("Error in getReusablePackages:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}

// Update a reusable package
export async function updateReusablePackage(packageId: string, updates: Partial<ReusablePackageInsert>) {
  const supabase = await createServerSupabaseClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect("/login")
    }

    // Validate the updates against the reusablePackageSchema
    const validatedUpdates = reusablePackageSchema.partial().parse(updates)

    // Update the package
    const { data, error } = await supabase
      .from("reusable_packages")
      .update(validatedUpdates)
      .eq("id", packageId)
      .select()
      .single()

    if (error) {
      console.error("Error updating reusable package:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/shipping")
    return { success: true, data }
  } catch (error) {
    console.error("Error in updateReusablePackage:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}

// Create a new shipping record
const createShippingInputSchema = shippingSchema.omit({ id: true, tracking_number: true })
type CreateShippingInput = z.input<typeof createShippingInputSchema>

export async function createShippingRecord(shippingData: CreateShippingInput) {
  const supabase = await createServerSupabaseClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: "User not authenticated" }
    }

    const validatedData = createShippingInputSchema.parse(shippingData)

    let carrierResponse
    if (validatedData.carrier?.toLowerCase() === "ups") {
      carrierResponse = await createUpsShipment({
        shipper: validatedData.origin_address,
        recipient: validatedData.destination_address,
        package: {
          weight: validatedData.weight || 1,
          dimensions: validatedData.dimensions || { length: 10, width: 10, height: 10, unit: "cm" },
        },
        service: { code: validatedData.service_level },
      })
    } else if (validatedData.carrier?.toLowerCase() === "fedex") {
      carrierResponse = await createFedexShipment({
        shipper: validatedData.origin_address,
        recipient: validatedData.destination_address,
        packages: [
          {
            weight: { value: validatedData.weight || 1, units: "LB" },
            dimensions: {
              length: validatedData.dimensions?.length || 10,
              width: validatedData.dimensions?.width || 10,
              height: validatedData.dimensions?.height || 10,
              units: "IN",
            },
          },
        ],
        serviceType: validatedData.service_level?.toUpperCase() || "FEDEX_GROUND",
      })
    } else {
      return { success: false, error: "Unsupported carrier selected." }
    }

    if (!carrierResponse.success || !carrierResponse.trackingNumber) {
      return { success: false, error: carrierResponse.error || "Failed to generate shipping label." }
    }

    const recordToInsert: ShippingInsert = {
      ...validatedData,
      user_id: user.id,
      tracking_number: carrierResponse.trackingNumber,
      label_image_base64: carrierResponse.labelImage,
      carrier_api_response: carrierResponse.rawResponse,
      status: "pending",
    }

    const { data, error } = await supabase.from("shipping").insert(recordToInsert).select().single()

    if (error) {
      console.error("Error creating shipping record in DB:", error)
      return { success: false, error: error.message }
    }

    if (validatedData.package_ids && validatedData.package_ids.length > 0) {
      const packageIds = Array.isArray(validatedData.package_ids)
        ? validatedData.package_ids
        : [validatedData.package_ids]
      const { error: updateError } = await supabase
        .from("reusable_packages")
        .update({ status: "in_use", current_shipment_id: data.id })
        .in("id", packageIds)

      if (updateError) {
        console.error("Error updating package status:", updateError)
        // Non-critical error, so we don't return failure here
      }
    }

    revalidatePath("/shipping")
    return { success: true, data }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred"
    console.error("Error in createShippingRecord:", errorMessage)
    return { success: false, error: errorMessage }
  }
}

// Update a shipping record
export async function updateShippingRecord(shippingId: string, updates: Partial<ShippingInsert>) {
  const supabase = await createServerSupabaseClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect("/login")
    }

    // Validate the updates against the shippingSchema
    const validatedUpdates = shippingSchema.partial().parse(updates)

    // Get the current shipping record to check for status changes
    const { data: currentShipping, error: fetchError } = await supabase
      .from("shipping")
      .select("status, package_ids")
      .eq("id", shippingId)
      .single()

    if (fetchError) {
      console.error("Error fetching current shipping record:", fetchError)
      return { success: false, error: fetchError.message }
    }

    // Update the shipping record
    const { data, error } = await supabase
      .from("shipping")
      .update(validatedUpdates)
      .eq("id", shippingId)
      .select()
      .single()

    if (error) {
      console.error("Error updating shipping record:", error)
      return { success: false, error: error.message }
    }

    // If the status changed to "delivered", update the packages to "available"
    if (
      updates.status === "delivered" &&
      currentShipping.status !== "delivered" &&
      currentShipping.package_ids &&
      currentShipping.package_ids.length > 0
    ) {
      const { error: updateError } = await supabase
        .from("reusable_packages")
        .update({
          status: "available",
          reuse_count: supabase.rpc("increment_reuse_count"),
        })
        .in("id", currentShipping.package_ids)

      if (updateError) {
        console.error("Error updating package status:", updateError)
      }
    }

    revalidatePath("/shipping")
    return { success: true, data }
  } catch (error) {
    console.error("Error in updateShippingRecord:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}

// Get shipping analytics
export async function getShippingAnalytics() {
  const supabase = await createServerSupabaseClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect("/login")
    }

    // Try to fetch from the view first
    const { data: viewData, error: viewError } = await supabase
      .from("shipping_analytics")
      .select("*")
      .order("shipping_day", { ascending: false })

    // If the view exists and returns data, use it
    if (!viewError && viewData) {
      return { success: true, data: viewData as ShippingAnalyticsRow[] }
    }

    // If the view doesn't exist, calculate analytics directly from shipping table
    console.log("Shipping analytics view not found, calculating directly from shipping table")

    // Fetch all shipping data
    const { data: shippingData, error: shippingError } = await supabase
      .from("shipping")
      .select("*")
      .order("shipping_date", { ascending: false })

    if (shippingError) {
      console.error("Error fetching shipping data:", shippingError)
      return { success: false, error: shippingError.message }
    }

    // Group by day and calculate metrics
    const analyticsMap = new Map()

    shippingData.forEach((shipment) => {
      if (!shipment.shipping_date) return

      // Get the day part only
      const shippingDay = shipment.shipping_date.split("T")[0]

      if (!analyticsMap.has(shippingDay)) {
        analyticsMap.set(shippingDay, {
          shipping_day: shippingDay,
          total_shipments: 0,
          delivered_count: 0,
          in_transit_count: 0,
          delayed_count: 0,
          total_weight: 0,
          avg_weight: 0,
        })
      }

      const dayStats = analyticsMap.get(shippingDay)
      dayStats.total_shipments++

      // Count by status
      if (shipment.status === "delivered") {
        dayStats.delivered_count++
      } else if (shipment.status === "in_transit") {
        dayStats.in_transit_count++
      } else if (shipment.status === "delayed") {
        dayStats.delayed_count++
      }

      // Add weight if available
      if (shipment.weight) {
        dayStats.total_weight += shipment.weight
      }
    })

    // Calculate averages and convert to array
    const analyticsData = Array.from(analyticsMap.values()).map((day) => {
      day.avg_weight = day.total_shipments > 0 ? day.total_weight / day.total_shipments : 0
      return day
    })

    // Sort by day descending
    analyticsData.sort((a, b) => new Date(b.shipping_day).getTime() - new Date(a.shipping_day).getTime())

    return { success: true, data: analyticsData }
  } catch (error) {
    console.error("Error in getShippingAnalytics:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}

// Get package utilization data
export async function getPackageUtilization() {
  const supabase = await createServerSupabaseClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect("/login")
    }

    // Try to fetch from the view first
    const { data: viewData, error: viewError } = await supabase
      .from("package_utilization")
      .select("*")
      .order("reuses_per_day", { ascending: false })

    // If the view exists and returns data, use it
    if (!viewError && viewData) {
      return { success: true, data: viewData as PackageUtilizationRow[] }
    }

    // If the view doesn't exist, calculate utilization directly
    console.log("Package utilization view not found, calculating directly")

    // Fetch packages data
    const { data: packagesData, error: packagesError } = await supabase.from("reusable_packages").select("*")

    if (packagesError) {
      console.error("Error fetching packages data:", packagesError)
      return { success: false, error: packagesError.message }
    }

    // Fetch shipping data to calculate usage
    const { data: shippingData, error: shippingError } = await supabase.from("shipping").select("*")

    if (shippingError) {
      console.error("Error fetching shipping data for package utilization:", shippingError)
      return { success: false, error: shippingError.message }
    }

    // Calculate utilization for each package
    const utilizationData = packagesData.map((pkg) => {
      // Count shipments using this package
      const shipmentsUsingPackage = shippingData.filter(
        (shipment) => shipment.package_ids && shipment.package_ids.includes(pkg.id),
      )

      // Find the last used date
      const lastUsedDate =
        shipmentsUsingPackage.length > 0
          ? shipmentsUsingPackage.sort(
              (a, b) => new Date(b.shipping_date || 0).getTime() - new Date(a.shipping_date || 0).getTime(),
            )[0].shipping_date
          : null

      // Calculate days since creation
      const creationDate = new Date(pkg.created_at || new Date())
      const daysSinceCreation = Math.max(
        1,
        Math.floor((new Date().getTime() - creationDate.getTime()) / (1000 * 60 * 60 * 24)),
      )

      // Calculate reuses per day
      const reusesPerDay = pkg.reuse_count ? pkg.reuse_count / daysSinceCreation : 0

      return {
        id: pkg.id,
        name: pkg.name,
        package_id: pkg.package_id,
        reuse_count: pkg.reuse_count || 0,
        status: pkg.status,
        shipment_count: shipmentsUsingPackage.length,
        last_used_date: lastUsedDate,
        created_at: pkg.created_at,
        days_since_creation: daysSinceCreation,
        reuses_per_day: reusesPerDay,
      }
    })

    // Sort by reuses per day descending
    utilizationData.sort((a, b) => b.reuses_per_day - a.reuses_per_day)

    return { success: true, data: utilizationData }
  } catch (error) {
    console.error("Error in getPackageUtilization:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}
