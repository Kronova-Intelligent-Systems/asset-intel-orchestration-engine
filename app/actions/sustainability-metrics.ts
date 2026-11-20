"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

// Define types for our metrics
export interface SustainabilityMetrics {
  carbonSaved: number
  treesEquivalent: number
  waterSaved: number
  plasticReduced: number
  packagingReused: number
  totalShipments: number
  costSavings: number
  roiPercentage: number
  goalProgress: {
    carbonReduction: {
      current: number
      target: number
      percentage: number
    }
    packagingReuse: {
      current: number
      target: number
      percentage: number
    }
    costReduction: {
      current: number
      target: number
      percentage: number
    }
  }
  monthlyData: Array<{
    month: string
    carbonSaved: number
    packagingReused: number
    costSavings: number
  }>
}

// Calculate ROI and sustainability metrics
export async function getSustainabilityMetrics() {
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

    // Fetch reusable packages data
    const { data: packagesData, error: packagesError } = await supabase
      .from("reusable_packages")
      .select("*")
      .order("created_at", { ascending: false })

    if (packagesError) {
      console.error("Error fetching packages data:", packagesError)
      return { success: false, error: packagesError.message }
    }

    // Calculate metrics
    const totalShipments = shippingData.length
    const packagingReused = packagesData.reduce((sum, pkg) => sum + (pkg.reuse_count || 0), 0)

    // Calculate carbon savings (kg CO2)
    // Assumption: Each reused package saves approximately 2.5kg of CO2
    const carbonSavedPerPackage = 2.5 // kg CO2
    const carbonSaved = packagingReused * carbonSavedPerPackage

    // Convert carbon saved to equivalent trees
    // Assumption: One tree absorbs about 25kg of CO2 per year
    const treesEquivalent = carbonSaved / 25

    // Calculate water saved (liters)
    // Assumption: Each reused package saves approximately 500 liters of water
    const waterSaved = packagingReused * 500

    // Calculate plastic reduced (kg)
    // Assumption: Each reused package reduces plastic waste by 0.5kg
    const plasticReduced = packagingReused * 0.5

    // Calculate cost savings ($)
    // Assumption: Each reused package saves approximately $5 in packaging costs
    const savingsPerPackage = 5
    const costSavings = packagingReused * savingsPerPackage

    // Calculate ROI percentage
    // Assumption: Initial investment of $10 per reusable package
    const initialInvestment = packagesData.length * 10
    const roiPercentage = initialInvestment > 0 ? (costSavings / initialInvestment) * 100 : 0

    // Calculate goal progress
    // These are example targets - in a real application, these would be stored in the database
    const carbonReductionTarget = 10000 // kg CO2
    const packagingReuseTarget = 2000 // reuses
    const costReductionTarget = 10000 // $

    const goalProgress = {
      carbonReduction: {
        current: carbonSaved,
        target: carbonReductionTarget,
        percentage: Math.min(100, (carbonSaved / carbonReductionTarget) * 100),
      },
      packagingReuse: {
        current: packagingReused,
        target: packagingReuseTarget,
        percentage: Math.min(100, (packagingReused / packagingReuseTarget) * 100),
      },
      costReduction: {
        current: costSavings,
        target: costReductionTarget,
        percentage: Math.min(100, (costSavings / costReductionTarget) * 100),
      },
    }

    // Generate monthly data for charts
    // In a real application, this would be calculated from actual data
    const monthlyData = generateMonthlyData(6, carbonSaved, packagingReused, costSavings)

    const metrics: SustainabilityMetrics = {
      carbonSaved,
      treesEquivalent,
      waterSaved,
      plasticReduced,
      packagingReused,
      totalShipments,
      costSavings,
      roiPercentage,
      goalProgress,
      monthlyData,
    }

    return { success: true, data: metrics }
  } catch (error) {
    console.error("Error in getSustainabilityMetrics:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}

// Helper function to generate monthly data for charts
function generateMonthlyData(
  months: number,
  totalCarbonSaved: number,
  totalPackagingReused: number,
  totalCostSavings: number,
) {
  const currentDate = new Date()
  const data = []

  // Distribution factors to make the data look more realistic
  const distributionFactors = [0.6, 0.7, 0.8, 0.9, 1.0, 1.1]

  for (let i = 0; i < months; i++) {
    const monthDate = new Date(currentDate)
    monthDate.setMonth(currentDate.getMonth() - (months - 1 - i))

    const factor = distributionFactors[i] || 1

    data.push({
      month: monthDate.toLocaleString("default", { month: "short", year: "2-digit" }),
      carbonSaved: (totalCarbonSaved / months) * factor,
      packagingReused: Math.round((totalPackagingReused / months) * factor),
      costSavings: (totalCostSavings / months) * factor,
    })
  }

  return data
}

// Get carbon footprint data for a specific shipment
export async function getShipmentCarbonFootprint(shipmentId: string) {
  const supabase = await createServerSupabaseClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect("/login")
    }

    // Fetch the shipment
    const { data: shipment, error: shipmentError } = await supabase
      .from("shipping")
      .select("*")
      .eq("id", shipmentId)
      .single()

    if (shipmentError) {
      console.error("Error fetching shipment:", shipmentError)
      return { success: false, error: shipmentError.message }
    }

    if (!shipment) {
      return { success: false, error: "Shipment not found" }
    }

    // Calculate carbon footprint
    // In a real application, this would be a more complex calculation based on
    // distance, weight, transportation method, etc.
    const distance = calculateDistance(shipment.origin_address, shipment.destination_address)

    const weight = shipment.weight || 1 // kg, default to 1 if not specified

    // Calculate carbon footprint (kg CO2)
    // Assumption: 0.1 kg CO2 per kg per km for standard shipping
    const carbonFootprint = distance * weight * 0.1

    // Calculate carbon savings from reusable packaging
    // Assumption: 30% reduction in carbon footprint from using reusable packaging
    const reusablePackagingSavings = shipment.package_ids && shipment.package_ids.length > 0 ? carbonFootprint * 0.3 : 0

    // Calculate total carbon footprint
    const totalCarbonFootprint = carbonFootprint - reusablePackagingSavings

    return {
      success: true,
      data: {
        shipmentId: shipment.id,
        distance,
        weight,
        carbonFootprint,
        reusablePackagingSavings,
        totalCarbonFootprint,
        transportMode: shipment.carrier || "Standard",
        packagingType: shipment.package_ids && shipment.package_ids.length > 0 ? "Reusable" : "Standard",
      },
    }
  } catch (error) {
    console.error("Error in getShipmentCarbonFootprint:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}

// Helper function to calculate distance between two addresses
function calculateDistance(originAddress: any, destinationAddress: any) {
  // In a real application, this would use a geocoding API and distance calculation
  // For this example, we'll use a simplified approach

  // Convert addresses to coordinates (simplified)
  const originCoordinates = addressToCoordinates(originAddress)
  const destinationCoordinates = addressToCoordinates(destinationAddress)

  // Calculate distance using Haversine formula
  const distance = haversineDistance(
    originCoordinates.latitude,
    originCoordinates.longitude,
    destinationCoordinates.latitude,
    destinationCoordinates.longitude,
  )

  return distance
}

// Helper function to convert address to coordinates (simplified)
function addressToCoordinates(address: any) {
  // In a real application, this would use a geocoding API
  // For this example, we'll use a simplified approach based on the country and state

  const countryCoordinates: Record<string, { lat: number; lng: number }> = {
    USA: { lat: 37.0902, lng: -95.7129 },
    Canada: { lat: 56.1304, lng: -106.3468 },
    UK: { lat: 55.3781, lng: -3.436 },
    // Add more countries as needed
  }

  const stateCoordinates: Record<string, { lat: number; lng: number }> = {
    CA: { lat: 36.7783, lng: -119.4179 },
    NY: { lat: 40.7128, lng: -74.006 },
    TX: { lat: 31.9686, lng: -99.9018 },
    // Add more states as needed
  }

  // Default coordinates (center of USA)
  let latitude = 37.0902
  let longitude = -95.7129

  // Try to get coordinates based on country
  if (address.country && countryCoordinates[address.country]) {
    latitude = countryCoordinates[address.country].lat
    longitude = countryCoordinates[address.country].lng
  }

  // Try to get more precise coordinates based on state
  if (address.state && stateCoordinates[address.state]) {
    latitude = stateCoordinates[address.state].lat
    longitude = stateCoordinates[address.state].lng
  }

  // Add some randomness to make it more realistic
  latitude += (Math.random() - 0.5) * 5
  longitude += (Math.random() - 0.5) * 5

  return { latitude, longitude }
}

// Helper function to calculate distance using Haversine formula
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371 // Earth's radius in km

  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distance = R * c

  return distance
}
