"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import {
  packagingOrderSchema,
  packagingMaterials,
  packageCategories,
  iotSensorInfo,
  sustainabilityPrograms,
  resendItPackage,
} from "@/lib/schemas/packaging"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

// Create a new packaging order
export async function createPackagingOrder(orderData: any) {
  const supabase = await createServerSupabaseClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect("/login")
    }

    // Get the user's profile
    const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", user.id).single()

    // Add user_id and profile_id to the order data
    const orderWithIds = {
      ...orderData,
      user_id: user.id,
      profile_id: profile?.id,
    }

    // Validate the order data
    const validatedData = packagingOrderSchema.parse(orderWithIds)

    // Calculate the total price
    const totalPrice = calculateOrderPrice(validatedData)

    // Calculate estimated CO2 savings
    const co2Savings = calculateCO2Savings(validatedData)

    // Create the order with the calculated price and CO2 savings
    const { data: order, error } = await supabase
      .from("packaging_orders")
      .insert({
        ...validatedData,
        total_price: totalPrice,
        estimated_co2_savings: co2Savings,
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating packaging order:", error)
      return { success: false, error: error.message }
    }

    // Send confirmation email to user
    await sendOrderConfirmationEmail(user.email!, order)

    // Send notification email to support
    await sendOrderNotificationEmail(order)

    revalidatePath("/packaging")
    return { success: true, data: order }
  } catch (error) {
    console.error("Error in createPackagingOrder:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}

// Calculate the total price of an order
function calculateOrderPrice(orderData: any) {
  // Get the base price for the package category
  const category = packageCategories.find((cat) => cat.id === orderData.package_category) || packageCategories[0]
  let basePrice = category.basePrice * orderData.quantity

  // Apply material price multiplier
  const material = packagingMaterials.find((mat) => mat.id === orderData.material_type) || packagingMaterials[0]
  let materialMultiplier = material.priceMultiplier

  // Check if this is a Resend-it premium package
  if (orderData.package_type === "resend_it_premium") {
    const size = orderData.dimensions
      ? resendItPackage.sizes.find(
          (s) =>
            s.dimensions.width === orderData.dimensions.width && s.dimensions.height === orderData.dimensions.height,
        )
      : resendItPackage.sizes[0]

    basePrice = size ? size.price * orderData.quantity : resendItPackage.sizes[0].price * orderData.quantity
    materialMultiplier = resendItPackage.priceMultiplier
  }

  // Add IoT sensor costs
  let iotSensorCost = 0
  if (orderData.has_iot_sensors && orderData.iot_sensor_count > 0) {
    let sensorBasePrice = iotSensorInfo.pricePerSensor

    // Add costs for specific sensor features
    if (orderData.iot_sensor_config) {
      const config = orderData.iot_sensor_config

      // Add temperature sensing cost
      if (config.temperatureSensing) {
        const feature = iotSensorInfo.features.find((f) => f.id === "temperatureSensing")
        if (feature) sensorBasePrice += feature.priceAdder
      }

      // Add humidity sensing cost
      if (config.humiditySensing) {
        const feature = iotSensorInfo.features.find((f) => f.id === "humiditySensing")
        if (feature) sensorBasePrice += feature.priceAdder
      }

      // Add location tracking cost
      if (config.locationTracking) {
        const feature = iotSensorInfo.features.find((f) => f.id === "locationTracking")
        if (feature) sensorBasePrice += feature.priceAdder
      }

      // Add shock detection cost
      if (config.shockDetection) {
        const feature = iotSensorInfo.features.find((f) => f.id === "shockDetection")
        if (feature) sensorBasePrice += feature.priceAdder
      }

      // Add tamper detection cost
      if (config.tamperDetection) {
        const feature = iotSensorInfo.features.find((f) => f.id === "tamperDetection")
        if (feature) sensorBasePrice += feature.priceAdder
      }

      // Add battery option cost
      if (config.batteryLife === "extended") {
        const battery = iotSensorInfo.batteryOptions.find((b) => b.id === "extended")
        if (battery) sensorBasePrice += battery.priceAdder
      }

      // Add reporting frequency cost
      const frequency = iotSensorInfo.reportingFrequencies.find((f) => f.id === config.reportingFrequency)
      if (frequency) sensorBasePrice += frequency.priceAdder
    }

    iotSensorCost = sensorBasePrice * orderData.iot_sensor_count
  }

  // Apply bulk order discounts
  let bulkDiscount = 0
  if (orderData.order_type === "bulk") {
    for (const threshold of sustainabilityPrograms.bulkDiscount.thresholds) {
      if (orderData.quantity >= threshold.quantity) {
        bulkDiscount = threshold.discount
      }
    }
  }

  // Add carbon offset cost if selected
  let carbonOffsetCost = 0
  if (orderData.carbon_offset) {
    carbonOffsetCost = basePrice * materialMultiplier * sustainabilityPrograms.carbonOffset.priceMultiplier
  }

  // Add return program cost if enrolled
  let returnProgramCost = 0
  if (orderData.return_program_enrollment) {
    returnProgramCost = sustainabilityPrograms.returnProgram.pricePerUnit * orderData.quantity
  }

  // Calculate subtotal before discount
  const subtotal = basePrice * materialMultiplier + iotSensorCost + carbonOffsetCost + returnProgramCost

  // Apply bulk discount
  const discount = subtotal * bulkDiscount

  // Calculate final price
  const totalPrice = subtotal - discount

  return Number.parseFloat(totalPrice.toFixed(2))
}

// Calculate the estimated CO2 savings
function calculateCO2Savings(orderData: any) {
  // Find the material to get its CO2 reduction factor
  const material = packagingMaterials.find((mat) => mat.id === orderData.material_type) || packagingMaterials[0]

  // Base CO2 savings from using sustainable packaging
  let co2Savings = material.co2Reduction * orderData.quantity

  // If it's a Resend-it premium package, use its specific CO2 reduction value
  if (orderData.package_type === "resend_it_premium") {
    co2Savings = resendItPackage.co2Reduction * orderData.quantity
  }

  // Additional savings from carbon offset program
  if (orderData.carbon_offset) {
    co2Savings *= 1.5 // 50% additional offset
  }

  // Additional savings from return program (accounting for reuse)
  if (orderData.return_program_enrollment) {
    co2Savings *= 1.25 // 25% additional savings from guaranteed reuse
  }

  return Number.parseFloat(co2Savings.toFixed(2))
}

// Get all packaging orders for the current user
export async function getUserPackagingOrders() {
  const supabase = await createServerSupabaseClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect("/login")
    }

    // Fetch packaging orders
    const { data: orders, error } = await supabase
      .from("packaging_orders")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching packaging orders:", error)
      return { success: false, error: error.message }
    }

    return { success: true, data: orders }
  } catch (error) {
    console.error("Error in getUserPackagingOrders:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}

// Get a specific packaging order by ID
export async function getPackagingOrderById(orderId: string) {
  const supabase = await createServerSupabaseClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect("/login")
    }

    // Fetch the packaging order
    const { data: order, error } = await supabase
      .from("packaging_orders")
      .select("*")
      .eq("id", orderId)
      .eq("user_id", user.id)
      .single()

    if (error) {
      console.error("Error fetching packaging order:", error)
      return { success: false, error: error.message }
    }

    return { success: true, data: order }
  } catch (error) {
    console.error("Error in getPackagingOrderById:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}

// Update a packaging order
export async function updatePackagingOrder(orderId: string, updates: any) {
  const supabase = await createServerSupabaseClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect("/login")
    }

    // Validate the updates
    const validatedUpdates = packagingOrderSchema.partial().parse(updates)

    // Recalculate price if necessary
    const updatedData = { ...validatedUpdates }

    if (
      updates.order_type ||
      updates.package_category ||
      updates.material_type ||
      updates.quantity ||
      updates.has_iot_sensors ||
      updates.iot_sensor_count ||
      updates.iot_sensor_config ||
      updates.carbon_offset ||
      updates.return_program_enrollment
    ) {
      // Get the current order data
      const { data: currentOrder } = await supabase.from("packaging_orders").select("*").eq("id", orderId).single()

      if (currentOrder) {
        // Merge current data with updates
        const mergedData = { ...currentOrder, ...validatedUpdates }

        // Recalculate price and CO2 savings
        updatedData.total_price = calculateOrderPrice(mergedData)
        updatedData.estimated_co2_savings = calculateCO2Savings(mergedData)
      }
    }

    // Update the order
    const { data, error } = await supabase
      .from("packaging_orders")
      .update(updatedData)
      .eq("id", orderId)
      .eq("user_id", user.id)
      .select()
      .single()

    if (error) {
      console.error("Error updating packaging order:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/packaging")
    revalidatePath(`/packaging/orders/${orderId}`)
    return { success: true, data }
  } catch (error) {
    console.error("Error in updatePackagingOrder:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}

// Cancel a packaging order
export async function cancelPackagingOrder(orderId: string) {
  const supabase = await createServerSupabaseClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect("/login")
    }

    // Update the order status to cancelled
    const { data, error } = await supabase
      .from("packaging_orders")
      .update({ status: "cancelled" })
      .eq("id", orderId)
      .eq("user_id", user.id)
      .select()
      .single()

    if (error) {
      console.error("Error cancelling packaging order:", error)
      return { success: false, error: error.message }
    }

    // Send cancellation email
    await sendOrderCancellationEmail(user.email!, data)

    revalidatePath("/packaging")
    revalidatePath(`/packaging/orders/${orderId}`)
    return { success: true, data }
  } catch (error) {
    console.error("Error in cancelPackagingOrder:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}

// Confirm a packaging order (for admin use)
export async function confirmPackagingOrder(orderId: string) {
  const supabase = await createServerSupabaseClient()

  try {
    // This should be protected by admin authentication in a real app
    // For demo purposes, we'll just update the status

    // Update the order status to confirmed
    const { data, error } = await supabase
      .from("packaging_orders")
      .update({
        status: "confirmed",
        expected_first_delivery_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 7 days from now
      })
      .eq("id", orderId)
      .select()
      .single()

    if (error) {
      console.error("Error confirming packaging order:", error)
      return { success: false, error: error.message }
    }

    // Send confirmation email to the user
    const { data: userData } = await supabase.from("profiles").select("email").eq("id", data.profile_id).single()

    if (userData?.email) {
      await sendOrderStatusUpdateEmail(userData.email, data)
    }

    revalidatePath("/packaging")
    revalidatePath(`/packaging/orders/${orderId}`)
    return { success: true, data }
  } catch (error) {
    console.error("Error in confirmPackagingOrder:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}

// Get packaging analytics for the current user
export async function getUserPackagingAnalytics() {
  const supabase = await createServerSupabaseClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect("/login")
    }

    // Fetch all user orders
    const { data: orders, error } = await supabase.from("packaging_orders").select("*").eq("user_id", user.id)

    if (error) {
      console.error("Error fetching packaging orders for analytics:", error)
      return { success: false, error: error.message }
    }

    // Calculate analytics
    const totalOrders = orders.length
    const totalSpent = orders.reduce((sum, order) => sum + (order.total_price || 0), 0)
    const totalCO2Saved = orders.reduce((sum, order) => sum + (order.estimated_co2_savings || 0), 0)
    const totalPackages = orders.reduce((sum, order) => sum + (order.quantity || 0), 0)

    // Calculate material usage breakdown
    const materialUsage = orders.reduce((acc, order) => {
      const material = order.material_type
      if (!acc[material]) acc[material] = 0
      acc[material] += order.quantity || 0
      return acc
    }, {})

    // Calculate package type breakdown
    const packageTypeUsage = orders.reduce((acc, order) => {
      const packageType = order.package_category
      if (!acc[packageType]) acc[packageType] = 0
      acc[packageType] += order.quantity || 0
      return acc
    }, {})

    // Calculate IoT sensor usage
    const iotSensorCount = orders.reduce((sum, order) => sum + (order.iot_sensor_count || 0), 0)

    // Calculate sustainability program participation
    const carbonOffsetParticipation = orders.filter((order) => order.carbon_offset).length / totalOrders
    const returnProgramParticipation = orders.filter((order) => order.return_program_enrollment).length / totalOrders

    return {
      success: true,
      data: {
        totalOrders,
        totalSpent,
        totalCO2Saved,
        totalPackages,
        materialUsage,
        packageTypeUsage,
        iotSensorCount,
        carbonOffsetParticipation,
        returnProgramParticipation,
      },
    }
  } catch (error) {
    console.error("Error in getUserPackagingAnalytics:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}

// Helper functions for sending emails
async function sendOrderConfirmationEmail(email: string, order: any) {
  try {
    // Get material and package category names
    const material = packagingMaterials.find((m) => m.id === order.material_type)
    const category = packageCategories.find((c) => c.id === order.package_category)

    // Format expected delivery date
    const deliveryDate = order.expected_first_delivery_date
      ? new Date(order.expected_first_delivery_date).toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "To be determined"

    await resend.emails.send({
      from: "orders@kronova.io",
      to: email,
      subject: `Order Confirmation - #${order.id.substring(0, 8)}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f0f9ff; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: #0f766e; margin: 0;">Thank you for your order!</h1>
            <p style="color: #334155;">Your sustainable packaging is on its way to making a difference.</p>
          </div>
          
          <div style="padding: 20px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
            <h2 style="color: #0f766e; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">Order Details</h2>
            <p><strong>Order ID:</strong> #${order.id.substring(0, 8)}</p>
            <p><strong>Status:</strong> ${order.status.charAt(0).toUpperCase() + order.status.slice(1)}</p>
            <p><strong>Expected Delivery:</strong> ${deliveryDate}</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr style="background-color: #f8fafc;">
                <th style="text-align: left; padding: 10px; border-bottom: 1px solid #e2e8f0;">Item</th>
                <th style="text-align: right; padding: 10px; border-bottom: 1px solid #e2e8f0;">Details</th>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">Package Type</td>
                <td style="text-align: right; padding: 10px; border-bottom: 1px solid #e2e8f0;">${category ? category.name : order.package_category}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">Material</td>
                <td style="text-align: right; padding: 10px; border-bottom: 1px solid #e2e8f0;">${material ? material.name : order.material_type}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">Quantity</td>
                <td style="text-align: right; padding: 10px; border-bottom: 1px solid #e2e8f0;">${order.quantity} units</td>
              </tr>
              ${
                order.has_iot_sensors
                  ? `
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">IoT Sensors</td>
                <td style="text-align: right; padding: 10px; border-bottom: 1px solid #e2e8f0;">${order.iot_sensor_count} sensors</td>
              </tr>
              `
                  : ""
              }
              ${
                order.carbon_offset
                  ? `
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">Carbon Offset</td>
                <td style="text-align: right; padding: 10px; border-bottom: 1px solid #e2e8f0;">Included</td>
              </tr>
              `
                  : ""
              }
              ${
                order.return_program_enrollment
                  ? `
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">Return Program</td>
                <td style="text-align: right; padding: 10px; border-bottom: 1px solid #e2e8f0;">Enrolled</td>
              </tr>
              `
                  : ""
              }
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;"><strong>Total Price</strong></td>
                <td style="text-align: right; padding: 10px; border-bottom: 1px solid #e2e8f0;"><strong>$${order.total_price.toFixed(2)}</strong></td>
              </tr>
              <tr>
                <td style="padding: 10px; color: #059669;"><strong>Estimated CO₂ Savings</strong></td>
                <td style="text-align: right; padding: 10px; color: #059669;"><strong>${order.estimated_co2_savings.toFixed(2)} kg</strong></td>
              </tr>
            </table>
            
            <div style="background-color: #f0fdf4; padding: 15px; border-radius: 8px; margin-top: 20px;">
              <h3 style="color: #059669; margin-top: 0;">Environmental Impact</h3>
              <p>Your choice of sustainable packaging is equivalent to:</p>
              <ul>
                <li>Saving ${(order.estimated_co2_savings * 0.11).toFixed(1)} gallons of gasoline</li>
                <li>Planting ${(order.estimated_co2_savings * 0.017).toFixed(1)} trees</li>
                <li>Avoiding ${(order.estimated_co2_savings * 4.3).toFixed(1)} miles of driving</li>
              </ul>
            </div>
            
            <div style="margin-top: 30px; text-align: center;">
              <p>You can view your order status at any time by visiting your <a href="${process.env.NEXT_PUBLIC_APP_URL}/packaging/orders/${order.id}" style="color: #0f766e; text-decoration: none; font-weight: bold;">account dashboard</a>.</p>
              <p>Thank you for choosing Kronova for your sustainable packaging needs!</p>
            </div>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #64748b; font-size: 12px;">
            <p>© ${new Date().getFullYear()} Kronova. All rights reserved.</p>
            <p>123 Sustainability Way, Green City, EC0 123</p>
          </div>
        </div>
      `,
    })
  } catch (error) {
    console.error("Error sending confirmation email:", error)
  }
}

async function sendOrderNotificationEmail(order: any) {
  try {
    const orderViewUrl = `${process.env.NEXT_PUBLIC_APP_URL}/admin/packaging/orders/${order.id}`

    // Get material and package category names
    const material = packagingMaterials.find((m) => m.id === order.material_type)
    const category = packageCategories.find((c) => c.id === order.package_category)

    await resend.emails.send({
      from: "orders@kronova.io",
      to: "support@kronova.io",
      subject: `New Packaging Order - #${order.id.substring(0, 8)}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f0f9ff; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: #0f766e; margin: 0;">New Order Received</h1>
            <p style="color: #334155;">A new sustainable packaging order has been submitted.</p>
          </div>
          
          <div style="padding: 20px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
            <h2 style="color: #0f766e; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">Order Details</h2>
            <p><strong>Order ID:</strong> #${order.id.substring(0, 8)}</p>
            <p><strong>Status:</strong> ${order.status.charAt(0).toUpperCase() + order.status.slice(1)}</p>
            <p><strong>Date Placed:</strong> ${new Date(order.created_at).toLocaleString()}</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr style="background-color: #f8fafc;">
                <th style="text-align: left; padding: 10px; border-bottom: 1px solid #e2e8f0;">Item</th>
                <th style="text-align: right; padding: 10px; border-bottom: 1px solid #e2e8f0;">Details</th>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">Package Type</td>
                <td style="text-align: right; padding: 10px; border-bottom: 1px solid #e2e8f0;">${category ? category.name : order.package_category}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">Material</td>
                <td style="text-align: right; padding: 10px; border-bottom: 1px solid #e2e8f0;">${material ? material.name : order.material_type}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">Quantity</td>
                <td style="text-align: right; padding: 10px; border-bottom: 1px solid #e2e8f0;">${order.quantity} units</td>
              </tr>
              ${
                order.has_iot_sensors
                  ? `
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">IoT Sensors</td>
                <td style="text-align: right; padding: 10px; border-bottom: 1px solid #e2e8f0;">${order.iot_sensor_count} sensors</td>
              </tr>
              `
                  : ""
              }
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;"><strong>Total Price</strong></td>
                <td style="text-align: right; padding: 10px; border-bottom: 1px solid #e2e8f0;"><strong>$${order.total_price.toFixed(2)}</strong></td>
              </tr>
            </table>
            
            <div style="margin-top: 30px; text-align: center;">
              <a href="${orderViewUrl}" style="background-color: #0f766e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">View and Process Order</a>
            </div>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #64748b; font-size: 12px;">
            <p>© ${new Date().getFullYear()} Kronova. All rights reserved.</p>
            <p>This is an automated message. Please do not reply directly to this email.</p>
          </div>
        </div>
      `,
    })
  } catch (error) {
    console.error("Error sending notification email:", error)
  }
}

async function sendOrderStatusUpdateEmail(email: string, order: any) {
  try {
    // Get material and package category names
    const material = packagingMaterials.find((m) => m.id === order.material_type)
    const category = packageCategories.find((c) => c.id === order.package_category)

    // Format expected delivery date
    const deliveryDate = order.expected_first_delivery_date
      ? new Date(order.expected_first_delivery_date).toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "To be determined"

    await resend.emails.send({
      from: "orders@kronova.io",
      to: email,
      subject: `Order Status Update - #${order.id.substring(0, 8)}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f0f9ff; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: #0f766e; margin: 0;">Your Order Status Has Been Updated</h1>
            <p style="color: #334155;">Your order is now: <strong>${order.status.toUpperCase()}</strong></p>
          </div>
          
          <div style="padding: 20px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
            <h2 style="color: #0f766e; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">Order Details</h2>
            <p><strong>Order ID:</strong> #${order.id.substring(0, 8)}</p>
            <p><strong>Expected Delivery:</strong> ${deliveryDate}</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr style="background-color: #f8fafc;">
                <th style="text-align: left; padding: 10px; border-bottom: 1px solid #e2e8f0;">Item</th>
                <th style="text-align: right; padding: 10px; border-bottom: 1px solid #e2e8f0;">Details</th>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">Package Type</td>
                <td style="text-align: right; padding: 10px; border-bottom: 1px solid #e2e8f0;">${category ? category.name : order.package_category}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">Material</td>
                <td style="text-align: right; padding: 10px; border-bottom: 1px solid #e2e8f0;">${material ? material.name : order.material_type}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">Quantity</td>
                <td style="text-align: right; padding: 10px; border-bottom: 1px solid #e2e8f0;">${order.quantity} units</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;"><strong>Status</strong></td>
                <td style="text-align: right; padding: 10px; border-bottom: 1px solid #e2e8f0;"><strong>${order.status.charAt(0).toUpperCase() + order.status.slice(1)}</strong></td>
              </tr>
            </table>
            
            <div style="background-color: #f0fdf4; padding: 15px; border-radius: 8px; margin-top: 20px;">
              <h3 style="color: #059669; margin-top: 0;">What's Next?</h3>
              ${
                order.status === "confirmed"
                  ? `
                <p>Your order has been confirmed and is now being processed. We'll begin production of your sustainable packaging shortly.</p>
                <p>Expected delivery: <strong>${deliveryDate}</strong></p>
              `
                  : ""
              }
              ${
                order.status === "processing"
                  ? `
                <p>Your sustainable packaging is now in production. We're crafting your items with care and attention to detail.</p>
                <p>Expected delivery: <strong>${deliveryDate}</strong></p>
              `
                  : ""
              }
              ${
                order.status === "shipped"
                  ? `
                <p>Your order is on its way! You can track your shipment using the tracking information provided.</p>
                <p>Expected delivery: <strong>${deliveryDate}</strong></p>
              `
                  : ""
              }
              ${
                order.status === "delivered"
                  ? `
                <p>Your order has been delivered! We hope you're enjoying your sustainable packaging solution.</p>
                <p>Remember, your packaging is designed to be reused multiple times. When you're done with it, please consider returning it through our return program or recycling it properly.</p>
              `
                  : ""
              }
            </div>
            
            <div style="margin-top: 30px; text-align: center;">
              <p>You can view your order status at any time by visiting your <a href="${process.env.NEXT_PUBLIC_APP_URL}/packaging/orders/${order.id}" style="color: #0f766e; text-decoration: none; font-weight: bold;">account dashboard</a>.</p>
              <p>Thank you for choosing Kronova for your sustainable packaging needs!</p>
            </div>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #64748b; font-size: 12px;">
            <p>© ${new Date().getFullYear()} Kronova. All rights reserved.</p>
            <p>123 Sustainability Way, Green City, EC0 123</p>
          </div>
        </div>
      `,
    })
  } catch (error) {
    console.error("Error sending status update email:", error)
  }
}

async function sendOrderCancellationEmail(email: string, order: any) {
  try {
    await resend.emails.send({
      from: "orders@kronova.io",
      to: email,
      subject: `Order Cancellation - #${order.id.substring(0, 8)}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #fee2e2; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: #b91c1c; margin: 0;">Your Order Has Been Cancelled</h1>
            <p style="color: #334155;">Order #${order.id.substring(0, 8)} has been cancelled as requested.</p>
          </div>
          
          <div style="padding: 20px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
            <p>We're sorry to see you cancel your order. If you have any feedback or if there's anything we can do to improve our service, please let us know.</p>
            
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin-top: 20px;">
              <h3 style="color: #0f766e; margin-top: 0;">Did You Know?</h3>
              <p>Sustainable packaging can reduce your carbon footprint by up to 70% compared to traditional packaging solutions.</p>
              <p>We hope to see you again soon for your sustainable packaging needs!</p>
            </div>
            
            <div style="margin-top: 30px; text-align: center;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/packaging" style="background-color: #0f766e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">Explore Our Products</a>
            </div>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #64748b; font-size: 12px;">
            <p>© ${new Date().getFullYear()} Kronova. All rights reserved.</p>
            <p>123 Sustainability Way, Green City, EC0 123</p>
          </div>
        </div>
      `,
    })
  } catch (error) {
    console.error("Error sending cancellation email:", error)
  }
}

// Helper function to get material name from ID
function getMaterialName(materialType: string): string {
  const material = packagingMaterials.find((m) => m.id === materialType)
  return material ? material.name : materialType
}

// Helper function to get package category name from ID
function getPackageCategoryName(categoryId: string): string {
  const category = packageCategories.find((c) => c.id === categoryId)
  return category ? category.name : categoryId
}
