"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { seedShippingEcosystem } from "@/scripts/seed-shipping-ecosystem"

export async function seedShippingEcosystemAction(packageCount = 50, shippingCount = 100) {
  try {
    const result = await seedShippingEcosystem(packageCount, shippingCount)

    if (result.success) {
      // Revalidate relevant pages
      revalidatePath("/shipping")
      revalidatePath("/packaging")
      revalidatePath("/sustainability")
      revalidatePath("/ai-suite")
    }

    return result
  } catch (error) {
    console.error("Error in shipping ecosystem seeding action:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    }
  }
}

export async function clearShippingData() {
  const supabase = await createServerSupabaseClient()

  try {
    // Clear in reverse dependency order
    await supabase.from("shipping").delete().neq("id", "00000000-0000-0000-0000-000000000000")
    await supabase.from("reusable_packages").delete().neq("id", "00000000-0000-0000-0000-000000000000")

    // Clear IoT sensors if table exists
    try {
      await supabase
        .from("iot_sensors" as any)
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000")
    } catch (error) {
      console.warn("IoT sensors table may not exist yet:", error)
    }

    revalidatePath("/shipping")
    revalidatePath("/packaging")

    return { success: true }
  } catch (error) {
    console.error("Error clearing shipping data:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    }
  }
}
