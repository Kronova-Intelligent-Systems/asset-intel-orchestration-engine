"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import {
  createCrmConnectionSchema,
  updateCrmConnectionSchema,
  crmAuthSchema,
  type CrmProvider,
} from "@/lib/schemas/crm"
import * as z from "zod"

// Create a new CRM connection
export async function createCrmConnection(formData: z.infer<typeof createCrmConnectionSchema>) {
  const supabase = await createServerSupabaseClient()

  try {
    // Get the current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: "User not authenticated" }
    }

    // Validate the form data
    const validatedData = createCrmConnectionSchema.parse({
      ...formData,
      user_id: user.id,
    })

    // Insert the CRM connection
    const { data, error } = await supabase.from("crm_connections").insert(validatedData).select().single()

    if (error) {
      console.error("Error creating CRM connection:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/admin/crm")
    return { success: true, data }
  } catch (error) {
    console.error("Error in createCrmConnection:", error)
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return { success: false, error: "An unexpected error occurred" }
  }
}

// Update an existing CRM connection
export async function updateCrmConnection(formData: z.infer<typeof updateCrmConnectionSchema>) {
  const supabase = await createServerSupabaseClient()

  try {
    // Get the current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: "User not authenticated" }
    }

    // Validate the form data
    const validatedData = updateCrmConnectionSchema.parse(formData)

    // Check if the connection belongs to the user
    const { data: existingConnection, error: fetchError } = await supabase
      .from("crm_connections")
      .select("id")
      .eq("id", validatedData.id)
      .eq("user_id", user.id)
      .single()

    if (fetchError || !existingConnection) {
      return { success: false, error: "Connection not found or access denied" }
    }

    // Update the CRM connection
    const { data, error } = await supabase
      .from("crm_connections")
      .update({
        ...validatedData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", validatedData.id)
      .select()
      .single()

    if (error) {
      console.error("Error updating CRM connection:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/admin/crm")
    return { success: true, data }
  } catch (error) {
    console.error("Error in updateCrmConnection:", error)
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return { success: false, error: "An unexpected error occurred" }
  }
}

// Delete a CRM connection
export async function deleteCrmConnection(connectionId: string) {
  const supabase = await createServerSupabaseClient()

  try {
    // Get the current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: "User not authenticated" }
    }

    // Check if the connection belongs to the user
    const { data: existingConnection, error: fetchError } = await supabase
      .from("crm_connections")
      .select("id")
      .eq("id", connectionId)
      .eq("user_id", user.id)
      .single()

    if (fetchError || !existingConnection) {
      return { success: false, error: "Connection not found or access denied" }
    }

    // Delete the CRM connection
    const { error } = await supabase.from("crm_connections").delete().eq("id", connectionId)

    if (error) {
      console.error("Error deleting CRM connection:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/admin/crm")
    return { success: true }
  } catch (error) {
    console.error("Error in deleteCrmConnection:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}

// Authenticate with a CRM provider
export async function authenticateCrmProvider(formData: z.infer<typeof crmAuthSchema>) {
  const supabase = await createServerSupabaseClient()

  try {
    // Get the current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: "User not authenticated" }
    }

    // Validate the form data
    const validatedData = crmAuthSchema.parse(formData)

    // Handle authentication based on provider
    let authResult: any = null
    let connectionData: any = null

    switch (validatedData.provider) {
      case "salesforce":
        authResult = await authenticateSalesforce(validatedData.credentials)
        break
      case "crmone":
        authResult = await authenticateCrmOne(validatedData.credentials)
        break
      case "netsuite":
        authResult = await authenticateNetSuite(validatedData.credentials)
        break
      default:
        return { success: false, error: "Unsupported CRM provider" }
    }

    if (!authResult.success) {
      return { success: false, error: authResult.error }
    }

    // Create a new CRM connection with the authentication result
    connectionData = {
      user_id: user.id,
      provider: validatedData.provider,
      name: `${validatedData.provider.charAt(0).toUpperCase() + validatedData.provider.slice(1)} Connection`,
      api_key: authResult.api_key || null,
      refresh_token: authResult.refresh_token || null,
      access_token: authResult.access_token || null,
      instance_url: authResult.instance_url || null,
      expires_at: authResult.expires_at || null,
      is_active: true,
    }

    // Insert the CRM connection
    const { data, error } = await supabase.from("crm_connections").insert(connectionData).select().single()

    if (error) {
      console.error("Error creating CRM connection:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/admin/crm")
    return { success: true, data }
  } catch (error) {
    console.error("Error in authenticateCrmProvider:", error)
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return { success: false, error: "An unexpected error occurred" }
  }
}

// Sync data from a CRM connection
export async function syncCrmData(connectionId: string) {
  const supabase = await createServerSupabaseClient()

  try {
    // Get the current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: "User not authenticated" }
    }

    // Get the CRM connection
    const { data: connection, error: connectionError } = await supabase
      .from("crm_connections")
      .select("*")
      .eq("id", connectionId)
      .eq("user_id", user.id)
      .single()

    if (connectionError || !connection) {
      return { success: false, error: "Connection not found or access denied" }
    }

    // Sync data based on provider
    let syncResult: any = null

    switch (connection.provider as CrmProvider) {
      case "salesforce":
        syncResult = await syncSalesforceData(connection)
        break
      case "crmone":
        syncResult = await syncCrmOneData(connection)
        break
      case "netsuite":
        syncResult = await syncNetSuiteData(connection)
        break
      default:
        return { success: false, error: "Unsupported CRM provider" }
    }

    if (!syncResult.success) {
      return { success: false, error: syncResult.error }
    }

    // Update the last sync time
    const { error: updateError } = await supabase
      .from("crm_connections")
      .update({
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", connectionId)

    if (updateError) {
      console.error("Error updating last sync time:", updateError)
      return { success: false, error: updateError.message }
    }

    revalidatePath("/admin/crm")
    return { success: true, data: syncResult.data }
  } catch (error) {
    console.error("Error in syncCrmData:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}

// Helper functions for CRM provider authentication and data syncing
async function authenticateSalesforce(credentials: any) {
  try {
    // In a real implementation, this would make API calls to Salesforce
    // For demo purposes, we'll simulate a successful authentication
    console.log("Authenticating with Salesforce:", credentials)

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000))

    return {
      success: true,
      access_token: "sf_mock_access_token_" + Math.random().toString(36).substring(2),
      refresh_token: "sf_mock_refresh_token_" + Math.random().toString(36).substring(2),
      instance_url: "https://example.salesforce.com",
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(), // 1 hour from now
    }
  } catch (error) {
    console.error("Error authenticating with Salesforce:", error)
    return { success: false, error: "Failed to authenticate with Salesforce" }
  }
}

async function authenticateCrmOne(credentials: any) {
  try {
    // In a real implementation, this would make API calls to CrmOne
    // For demo purposes, we'll simulate a successful authentication
    console.log("Authenticating with CrmOne:", credentials)

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000))

    return {
      success: true,
      api_key: credentials.api_key,
      instance_url: `https://${credentials.subdomain}.crmone.com`,
    }
  } catch (error) {
    console.error("Error authenticating with CrmOne:", error)
    return { success: false, error: "Failed to authenticate with CrmOne" }
  }
}

async function authenticateNetSuite(credentials: any) {
  try {
    // In a real implementation, this would make API calls to NetSuite
    // For demo purposes, we'll simulate a successful authentication
    console.log("Authenticating with NetSuite:", credentials)

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000))

    return {
      success: true,
      access_token: "ns_mock_access_token_" + Math.random().toString(36).substring(2),
      refresh_token: "ns_mock_refresh_token_" + Math.random().toString(36).substring(2),
      instance_url: `https://${credentials.account_id}.netsuite.com`,
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(), // 1 hour from now
    }
  } catch (error) {
    console.error("Error authenticating with NetSuite:", error)
    return { success: false, error: "Failed to authenticate with NetSuite" }
  }
}

async function syncSalesforceData(connection: any) {
  const supabase = await createServerSupabaseClient()

  try {
    // In a real implementation, this would make API calls to Salesforce
    // For demo purposes, we'll generate mock data
    console.log("Syncing data from Salesforce:", connection)

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Generate mock contacts
    const mockContacts = Array.from({ length: 10 }, (_, i) => ({
      connection_id: connection.id,
      user_id: connection.user_id,
      external_id: `sf_contact_${i}_${Date.now()}`,
      first_name: `John${i}`,
      last_name: `Doe${i}`,
      email: `john.doe${i}@example.com`,
      phone: `+1-555-${100 + i}-${1000 + i}`,
      company: `Acme Inc ${i}`,
      job_title: `Sales Manager ${i}`,
      status: i % 2 === 0 ? "Active" : "Inactive",
      tags: ["salesforce", `tag${i}`],
      custom_fields: { salesforce_id: `SF${i}${Date.now()}` },
    }))

    // Insert contacts
    const { error: contactsError } = await supabase.from("crm_contacts").insert(mockContacts)

    if (contactsError) {
      console.error("Error inserting Salesforce contacts:", contactsError)
      return { success: false, error: contactsError.message }
    }

    // Generate mock deals
    const mockDeals = Array.from({ length: 5 }, (_, i) => ({
      connection_id: connection.id,
      user_id: connection.user_id,
      external_id: `sf_deal_${i}_${Date.now()}`,
      name: `Deal ${i}`,
      stage: ["Prospecting", "Qualification", "Proposal", "Negotiation", "Closed Won"][i],
      amount: 10000 * (i + 1),
      currency: "USD",
      close_date: new Date(Date.now() + (i + 1) * 86400000).toISOString(), // i days from now
      probability: 20 * (i + 1),
      description: `This is a mock Salesforce deal ${i}`,
      custom_fields: { salesforce_opportunity_id: `SFO${i}${Date.now()}` },
    }))

    // Insert deals
    const { error: dealsError } = await supabase.from("crm_deals").insert(mockDeals)

    if (dealsError) {
      console.error("Error inserting Salesforce deals:", dealsError)
      return { success: false, error: dealsError.message }
    }

    // Generate mock activities
    const mockActivities = Array.from({ length: 15 }, (_, i) => ({
      connection_id: connection.id,
      user_id: connection.user_id,
      external_id: `sf_activity_${i}_${Date.now()}`,
      type: ["call", "email", "meeting", "task"][i % 4] as "call" | "email" | "meeting" | "task",
      subject: `Activity ${i}`,
      description: `This is a mock Salesforce activity ${i}`,
      status: i % 2 === 0 ? "Completed" : "Pending",
      priority: ["High", "Medium", "Low"][i % 3],
      due_date: new Date(Date.now() + (i + 1) * 86400000).toISOString(), // i days from now
      custom_fields: { salesforce_activity_id: `SFA${i}${Date.now()}` },
    }))

    // Insert activities
    const { error: activitiesError } = await supabase.from("crm_activities").insert(mockActivities)

    if (activitiesError) {
      console.error("Error inserting Salesforce activities:", activitiesError)
      return { success: false, error: activitiesError.message }
    }

    return {
      success: true,
      data: {
        contacts: mockContacts.length,
        deals: mockDeals.length,
        activities: mockActivities.length,
      },
    }
  } catch (error) {
    console.error("Error syncing Salesforce data:", error)
    return { success: false, error: "Failed to sync Salesforce data" }
  }
}

async function syncCrmOneData(connection: any) {
  const supabase = await createServerSupabaseClient()

  try {
    // In a real implementation, this would make API calls to CrmOne
    // For demo purposes, we'll generate mock data
    console.log("Syncing data from CrmOne:", connection)

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Generate mock contacts
    const mockContacts = Array.from({ length: 8 }, (_, i) => ({
      connection_id: connection.id,
      user_id: connection.user_id,
      external_id: `crmone_contact_${i}_${Date.now()}`,
      first_name: `Jane${i}`,
      last_name: `Smith${i}`,
      email: `jane.smith${i}@example.com`,
      phone: `+1-555-${200 + i}-${2000 + i}`,
      company: `XYZ Corp ${i}`,
      job_title: `Marketing Director ${i}`,
      status: i % 2 === 0 ? "Active" : "Inactive",
      tags: ["crmone", `tag${i}`],
      custom_fields: { crmone_id: `CO${i}${Date.now()}` },
    }))

    // Insert contacts
    const { error: contactsError } = await supabase.from("crm_contacts").insert(mockContacts)

    if (contactsError) {
      console.error("Error inserting CrmOne contacts:", contactsError)
      return { success: false, error: contactsError.message }
    }

    // Generate mock deals
    const mockDeals = Array.from({ length: 4 }, (_, i) => ({
      connection_id: connection.id,
      user_id: connection.user_id,
      external_id: `crmone_deal_${i}_${Date.now()}`,
      name: `Project ${i}`,
      stage: ["Discovery", "Proposal", "Negotiation", "Closed"][i],
      amount: 15000 * (i + 1),
      currency: "USD",
      close_date: new Date(Date.now() + (i + 1) * 86400000).toISOString(), // i days from now
      probability: 25 * (i + 1),
      description: `This is a mock CrmOne deal ${i}`,
      custom_fields: { crmone_opportunity_id: `COO${i}${Date.now()}` },
    }))

    // Insert deals
    const { error: dealsError } = await supabase.from("crm_deals").insert(mockDeals)

    if (dealsError) {
      console.error("Error inserting CrmOne deals:", dealsError)
      return { success: false, error: dealsError.message }
    }

    // Generate mock activities
    const mockActivities = Array.from({ length: 12 }, (_, i) => ({
      connection_id: connection.id,
      user_id: connection.user_id,
      external_id: `crmone_activity_${i}_${Date.now()}`,
      type: ["call", "email", "meeting", "task"][i % 4] as "call" | "email" | "meeting" | "task",
      subject: `Task ${i}`,
      description: `This is a mock CrmOne activity ${i}`,
      status: i % 2 === 0 ? "Completed" : "Pending",
      priority: ["High", "Medium", "Low"][i % 3],
      due_date: new Date(Date.now() + (i + 1) * 86400000).toISOString(), // i days from now
      custom_fields: { crmone_activity_id: `COA${i}${Date.now()}` },
    }))

    // Insert activities
    const { error: activitiesError } = await supabase.from("crm_activities").insert(mockActivities)

    if (activitiesError) {
      console.error("Error inserting CrmOne activities:", activitiesError)
      return { success: false, error: activitiesError.message }
    }

    return {
      success: true,
      data: {
        contacts: mockContacts.length,
        deals: mockDeals.length,
        activities: mockActivities.length,
      },
    }
  } catch (error) {
    console.error("Error syncing CrmOne data:", error)
    return { success: false, error: "Failed to sync CrmOne data" }
  }
}

async function syncNetSuiteData(connection: any) {
  const supabase = await createServerSupabaseClient()

  try {
    // In a real implementation, this would make API calls to NetSuite
    // For demo purposes, we'll generate mock data
    console.log("Syncing data from NetSuite:", connection)

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Generate mock contacts
    const mockContacts = Array.from({ length: 12 }, (_, i) => ({
      connection_id: connection.id,
      user_id: connection.user_id,
      external_id: `netsuite_contact_${i}_${Date.now()}`,
      first_name: `Robert${i}`,
      last_name: `Johnson${i}`,
      email: `robert.johnson${i}@example.com`,
      phone: `+1-555-${300 + i}-${3000 + i}`,
      company: `Global Inc ${i}`,
      job_title: `Finance Manager ${i}`,
      status: i % 2 === 0 ? "Active" : "Inactive",
      tags: ["netsuite", `tag${i}`],
      custom_fields: { netsuite_id: `NS${i}${Date.now()}` },
    }))

    // Insert contacts
    const { error: contactsError } = await supabase.from("crm_contacts").insert(mockContacts)

    if (contactsError) {
      console.error("Error inserting NetSuite contacts:", contactsError)
      return { success: false, error: contactsError.message }
    }

    // Generate mock deals
    const mockDeals = Array.from({ length: 6 }, (_, i) => ({
      connection_id: connection.id,
      user_id: connection.user_id,
      external_id: `netsuite_deal_${i}_${Date.now()}`,
      name: `Contract ${i}`,
      stage: ["Prospecting", "Needs Analysis", "Proposal", "Negotiation", "Closed Won", "Closed Lost"][i],
      amount: 20000 * (i + 1),
      currency: "USD",
      close_date: new Date(Date.now() + (i + 1) * 86400000).toISOString(), // i days from now
      probability: 15 * (i + 1),
      description: `This is a mock NetSuite deal ${i}`,
      custom_fields: { netsuite_opportunity_id: `NSO${i}${Date.now()}` },
    }))

    // Insert deals
    const { error: dealsError } = await supabase.from("crm_deals").insert(mockDeals)

    if (dealsError) {
      console.error("Error inserting NetSuite deals:", dealsError)
      return { success: false, error: dealsError.message }
    }

    // Generate mock activities
    const mockActivities = Array.from({ length: 18 }, (_, i) => ({
      connection_id: connection.id,
      user_id: connection.user_id,
      external_id: `netsuite_activity_${i}_${Date.now()}`,
      type: ["call", "email", "meeting", "task"][i % 4] as "call" | "email" | "meeting" | "task",
      subject: `Event ${i}`,
      description: `This is a mock NetSuite activity ${i}`,
      status: i % 2 === 0 ? "Completed" : "Pending",
      priority: ["High", "Medium", "Low"][i % 3],
      due_date: new Date(Date.now() + (i + 1) * 86400000).toISOString(), // i days from now
      custom_fields: { netsuite_activity_id: `NSA${i}${Date.now()}` },
    }))

    // Insert activities
    const { error: activitiesError } = await supabase.from("crm_activities").insert(mockActivities)

    if (activitiesError) {
      console.error("Error inserting NetSuite activities:", activitiesError)
      return { success: false, error: activitiesError.message }
    }

    return {
      success: true,
      data: {
        contacts: mockContacts.length,
        deals: mockDeals.length,
        activities: mockActivities.length,
      },
    }
  } catch (error) {
    console.error("Error syncing NetSuite data:", error)
    return { success: false, error: "Failed to sync NetSuite data" }
  }
}
