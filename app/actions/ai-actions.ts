"use server"

// Import necessary modules and types
import { revalidatePath } from "next/cache"
import { AgentSystem } from "@/lib/ai/agent-system"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { AIClient } from "@/lib/ai/ai-client"
import { CodeGenerator } from "@/lib/developer/code-generator"
import { SupplyChainOptimizer } from "@/lib/supply-chain/optimizer"
import * as z from "zod"
import { createAgentSchema, updateAgentSchema } from "@/lib/schemas/ai"
import { cookies } from "next/headers"
import { createDatabaseConnectionSchema, updateDatabaseConnectionSchema } from "@/lib/schemas/data-sources"
import type {
  DatabaseConnection,
  CreateDatabaseConnectionInput,
  UpdateDatabaseConnectionInput,
} from "@/lib/types/database"

// Add these imports at the top
import { createSupabaseProjectFormSchema } from "@/lib/schemas/managed-databases"
import type { CreateSupabaseProjectFormValues, UserManagedSupabaseProject } from "@/lib/types/database"
import { v4 as uuidv4 } from "uuid"
import type { CreateUserManagedSupabaseProjectInput } from "@/lib/types/database"
import { WorkflowSystem } from "@/lib/workflows/workflow-system"
import { formatAssetContext } from "@/lib/utils/asset-context-formatter"

// Define the CRM provider type
type CrmProvider = "salesforce" | "crmone" | "netsuite"
// Define the AI provider type
type AIProvider = "openai" | "anthropic" | "google" | "mistral" | "meta"

// Define Zod schemas for CRM connection data
const createCrmConnectionSchema = z.object({
  name: z.string().min(3).max(50),
  provider: z.enum(["salesforce", "crmone", "netsuite"]),
  api_key: z.string().optional(),
  refresh_token: z.string().optional(),
  access_token: z.string().optional(),
  instance_url: z.string().url().optional(),
  expires_at: z.string().optional(),
  is_active: z.boolean().default(true),
})

const updateCrmConnectionSchema = z.object({
  id: z.string(),
  name: z.string().min(3).max(50),
  provider: z.enum(["salesforce", "crmone", "netsuite"]),
  api_key: z.string().optional(),
  refresh_token: z.string().optional(),
  access_token: z.string().optional(),
  instance_url: z.string().url().optional(),
  expires_at: z.string().optional(),
  is_active: z.boolean().default(true),
})

const crmAuthSchema = z.object({
  provider: z.enum(["salesforce", "crmone", "netsuite"]),
  credentials: z.record(z.string(), z.any()), // Adjust based on expected credentials
})

// Create AI Agent
export async function createAgent(formData: z.infer<typeof createAgentSchema> & { user_id: string; tools?: string[] }) {
  const cookieStore = cookies
  const supabase = await createServerSupabaseClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return {
        success: false,
        error: "User not authenticted",
      }
    }
    // Validate the form data
    const validatedData = createAgentSchema.parse(formData)

    const agentData = {
      ...validatedData,
      user_id: formData.user_id,
      tools: formData.tools || [], // Store as simple string array
    }

    // Insert the AI agent
    const { data, error } = await supabase.from("ai_agents").insert(agentData).select().single()

    if (error) {
      console.error("Error creating AI agent:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/ai-suite/agents")
    return { success: true, data }
  } catch (error) {
    console.error("Error in createAgent:", error)
    if (error instanceof z.ZodError) {
      return { success: false, message: error.issues[0].message }
    }
    return { success: false, error: "An unexpected error occurred" }
  }
}

export async function updateAgent(formData: z.infer<typeof updateAgentSchema> & { user_id: string; tools?: string[] }) {
  let supabase
  try {
    supabase = await createServerSupabaseClient()
    if (!supabase) {
      return { success: false, error: "Database connection not available" }
    }
  } catch (error) {
    console.error("Error creating Supabase client:", error)
    return { success: false, error: "Database connection failed" }
  }

  try {
    // Check if the agent belongs to the user
    const { data: existingAgent, error: fetchError } = await supabase
      .from("ai_agents")
      .select("id")
      .eq("id", formData.id)
      .eq("user_id", formData.user_id)
      .single()

    if (fetchError || !existingAgent) {
      return { success: false, error: "Agent not found or access denied" }
    }

    const validatedData = updateAgentSchema.parse(formData)

    const updateData = {
      ...validatedData,
      tools: formData.tools || [], // Store as simple string array
      updated_at: new Date().toISOString(),
    }

    // Update the AI agent
    const { data, error } = await supabase.from("ai_agents").update(updateData).eq("id", formData.id).select().single()

    if (error) {
      console.error("Error updating AI agent:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/ai-suite/agents")
    return { success: true, data }
  } catch (error) {
    console.error("Error in updateAgent:", error)
    if (error instanceof z.ZodError) {
      return { success: false, message: error.issues[0].message }
    }
    return { success: false, error: "An unexpected error occurred" }
  }
}

// Delete an AI agent
export async function deleteAgent(agentId: string) {
  const supabase = await createServerSupabaseClient()

  try {
    // Get the current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: "User not authenticated" }
    }

    // Check if the agent belongs to the user
    const { data: existingAgent, error: fetchError } = await supabase
      .from("ai_agents")
      .select("id")
      .eq("id", agentId)
      .eq("user_id", user.id)
      .single()

    if (fetchError || !existingAgent) {
      return { success: false, error: "Agent not found or access denied" }
    }

    // Delete the AI agent
    const { error } = await supabase.from("ai_agents").delete().eq("id", agentId)

    if (error) {
      console.error("Error deleting AI agent:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/ai-suite/agents")
    return { success: true }
  } catch (error) {
    console.error("Error in deleteAgent:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}

// Execute an AI agent
export async function executeAgent({
  agentId,
  prompt,
  assetIds = [],
  tables = [],
  endpoints = [],
  includeLearningData = false,
  dataStreamIds = [],
}: {
  agentId: string
  prompt: string
  assetIds?: string[]
  tables?: string[]
  endpoints?: string[]
  includeLearningData?: boolean
  dataStreamIds?: string[]
}) {
  const supabase = await createServerSupabaseClient()

  try {
    console.log("[v0] executeAgent action called with agentId:", agentId)
    console.log("[v0] Prompt:", prompt)
    console.log("[v0] Asset IDs:", assetIds)
    console.log("[v0] Tables:", tables)
    console.log("[v0] Endpoints:", endpoints)
    console.log("[v0] Include Learning Data:", includeLearningData)
    console.log("[v0] Data Stream IDs:", dataStreamIds)

    // Get the current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: "User not authenticated" }
    }

    // Get the agent details
    const { data: agent, error: agentError } = await supabase
      .from("ai_agents")
      .select("*, ai_models(*)")
      .eq("id", agentId)
      .maybeSingle()

    console.log("[v0] Agent fetched from database:", JSON.stringify(agent, null, 2))

    if (agentError) {
      console.error("Error fetching agent:", agentError)
      return { success: false, error: `Error fetching agent: ${agentError.message}` }
    }

    if (!agent) {
      return { success: false, error: "Agent not found" }
    }

    console.log("[v0] Agent system_prompt:", agent.system_prompt)
    console.log("[v0] Agent description:", agent.description)
    console.log("[v0] Agent tools:", agent.tools)

    let assetContext = ""
    if (assetIds && assetIds.length > 0) {
      console.log("[v0] Formatting comprehensive asset context...")
      assetContext = await formatAssetContext(assetIds, user.id)
      console.log("[v0] Asset context prepared, length:", assetContext.length)
    }

    let additionalContext = ""

    if (tables && tables.length > 0) {
      additionalContext += `\n\nAvailable Database Tables: ${tables.join(", ")}`
      console.log("[v0] Added tables context:", tables)
    }

    if (endpoints && endpoints.length > 0) {
      additionalContext += `\n\nAvailable API Endpoints: ${endpoints.join(", ")}`
      console.log("[v0] Added endpoints context:", endpoints)
    }

    if (includeLearningData) {
      additionalContext += `\n\nNote: Include learning data and historical patterns in your analysis.`
      console.log("[v0] Including learning data context")
    }

    if (dataStreamIds && dataStreamIds.length > 0) {
      additionalContext += `\n\nData Stream IDs for context: ${dataStreamIds.join(", ")}`
      console.log("[v0] Added data streams context:", dataStreamIds)
    }

    const agentSystem = new AgentSystem(supabase)

    const fullPrompt = `${assetContext}${additionalContext}\n\n${prompt}`
    console.log("[v0] Full prompt with all context, length:", fullPrompt.length)

    const result = await agentSystem.executeAgent(agentId, fullPrompt, { verbose: true, userId: user.id })

    console.log("[v0] Agent execution result:", result)

    return { success: true, response: result.finalResponse, data: result }
  } catch (error) {
    console.error("Error in executeAgent:", error)
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred"
    const errorDigest = (error as any)?.digest

    console.error("[v0] executeAgent error details:", {
      message: errorMessage,
      digest: errorDigest,
      stack: error instanceof Error ? error.stack : undefined,
    })

    return {
      success: false,
      error: errorMessage,
      digest: errorDigest,
    }
  }
}

// Create a new workflow
export async function createWorkflow(formData: any) {
  const supabase = await createServerSupabaseClient()

  try {
    // Get the current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: "User not authenticated" }
    }

    // Insert the AI workflow
    const { data, error } = await supabase.from("ai_workflows").insert(formData).select().single()

    if (error) {
      console.error("Error creating workflow:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/ai-suite/workflows")
    return { success: true, data }
  } catch (error) {
    console.error("Error in createWorkflow:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}

// Update an existing workflow
export async function updateWorkflow(formData: any) {
  const supabase = await createServerSupabaseClient()

  try {
    // Get the current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: "User not authenticated" }
    }

    // Check if the workflow belongs to the user
    const { data: existingWorkflow, error: fetchError } = await supabase
      .from("ai_workflows")
      .select("id")
      .eq("id", formData.id)
      .eq("user_id", user.id)
      .single()

    if (fetchError || !existingWorkflow) {
      return { success: false, error: "Workflow not found or access denied" }
    }

    // Update the AI workflow
    const { data, error } = await supabase
      .from("ai_workflows")
      .update({
        ...formData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", formData.id)
      .select()
      .single()

    if (error) {
      console.error("Error updating AI workflow:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/ai-suite/workflows")
    return { success: true, data }
  } catch (error) {
    console.error("Error in updateWorkflow:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}

// Delete a workflow
export async function deleteWorkflow(workflowId: string) {
  const supabase = await createServerSupabaseClient()

  try {
    // Get the current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: "User not authenticated" }
    }

    // Check if the workflow belongs to the user
    const { data: existingWorkflow, error: fetchError } = await supabase
      .from("ai_workflows")
      .select("id")
      .eq("id", workflowId)
      .eq("user_id", user.id)
      .single()

    if (fetchError || !existingWorkflow) {
      return { success: false, error: "Workflow not found or access denied" }
    }

    // Delete the AI workflow
    const { error } = await supabase.from("ai_workflows").delete().eq("id", workflowId)

    if (error) {
      console.error("Error deleting AI workflow:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/ai-suite/workflows")
    return { success: true }
  } catch (error) {
    console.error("Error in deleteWorkflow:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}

// Execute a workflow
export async function executeWorkflow(workflowId: string, input: Record<string, any> = {}) {
  try {
    // Get the current user
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return { success: false, error: "Authentication required" }
    }

    const workflowSystem = new WorkflowSystem(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, // Use service role key for server operations
    )

    // Execute the workflow
    const result = await workflowSystem.executeWorkflow(workflowId, user.id, input)

    return { success: true, data: result }
  } catch (error) {
    console.error("Error in executeWorkflow:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}

// Mint NFT function (local database)
// Removed mintNFT function - moved to nft-sui-actions.ts

// Mint Sui NFT function (on blockchain)
// Removed mintSuiNFT function - moved to nft-sui-actions.ts

// Save Sui NFT function
// Removed saveSuiNFT function - moved to nft-sui-actions.ts

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

// Generate AI response
export async function generateAIResponse({
  messages,
  model,
  temperature,
}: {
  messages: Array<{ role: "user" | "assistant"; content: string }>
  model: string
  temperature: number
}) {
  try {
    // Get the model details from the database to determine the provider
    const supabase = await createServerSupabaseClient()
    const { data: modelData, error: modelError } = await supabase
      .from("ai_models")
      .select("provider, model_id")
      .eq("model_id", model)
      .maybeSingle()

    if (modelError) {
      console.error("Error fetching model details:", modelError)
      return { success: false, error: "Failed to fetch model details" }
    }

    // Determine the provider and API key
    let provider: AIProvider = "openai" // Default
    let apiKey = ""

    if (modelData) {
      provider = modelData.provider.toLowerCase() as AIProvider

      switch (provider) {
        case "openai":
          apiKey = process.env.OPENAI_API_KEY || ""
          break
        case "anthropic":
          apiKey = process.env.ANTHROPIC_API_KEY || ""
          break
        case "google":
          apiKey = process.env.GOOGLE_API_KEY || ""
          break
        case "mistral":
          apiKey = process.env.MISTRAL_API_KEY || ""
          break
        case "meta":
          apiKey = process.env.META_API_KEY || ""
          break
        default:
          return { success: false, error: `Unsupported provider: ${provider}` }
      }
    } else {
      // If model not found in database, try to infer provider from model name
      if (model.startsWith("gpt-")) {
        provider = "openai"
        apiKey = process.env.OPENAI_API_KEY || ""
      } else if (model.startsWith("claude-")) {
        provider = "anthropic"
        apiKey = process.env.ANTHROPIC_API_KEY || ""
      } else if (model.startsWith("gemini-")) {
        provider = "google"
        apiKey = process.env.GOOGLE_API_KEY || ""
      } else if (model.startsWith("mistral-")) {
        provider = "mistral"
        apiKey = process.env.MISTRAL_API_KEY || ""
      } else if (model.startsWith("llama-")) {
        provider = "meta"
        apiKey = process.env.META_API_KEY || ""
      } else {
        return { success: false, error: `Could not determine provider for model: ${model}` }
      }
    }

    if (!apiKey) {
      return { success: false, error: `API key not found for provider: ${provider}` }
    }

    try {
      console.log(`Using provider: ${provider} for model: ${model}`)

      const aiClient = new AIClient(provider, apiKey, model)

      // Add specific logging for Meta models
      if (provider === "meta") {
        console.log("Using Meta Llama model with API key:", apiKey ? "API key present" : "API key missing")
      }

      const response = await aiClient.createChatCompletion({
        model,
        messages: messages.map(({ role, content }) => ({ role, content })),
        temperature,
        max_tokens: 1000,
      })

      // Check for empty or invalid response
      if (!response || !response.choices || response.choices.length === 0) {
        console.error("Empty or invalid response from AI provider:", response)
        return {
          success: false,
          error: `Invalid response from ${provider} API`,
        }
      }

      return { success: true, response: response.choices[0].message.content }
    } catch (error) {
      console.error(`Error generating AI response with ${provider} model:`, error)
      return {
        success: false,
        error:
          error instanceof Error
            ? `Failed to generate response with ${provider} model: ${error.message}`
            : `Failed to generate response with ${provider} model`,
      }
    }
  } catch (error) {
    console.error("Error generating AI response:", error)
    return {
      success: false,
      error: error instanceof Error ? `Failed to generate response: ${error.message}` : "Failed to generate response",
    }
  }
}

// Generate code
export async function generateCode({
  language,
  description,
  framework,
}: {
  language: string
  description: string
  framework?: string
}) {
  try {
    const codeGenerator = new CodeGenerator(process.env.OPENAI_API_KEY || "")

    const result = await codeGenerator.generateCode({
      language,
      description,
      framework,
    })

    return { success: true, code: result.code, explanation: result.explanation, suggestions: result.suggestions }
  } catch (error) {
    console.error("Error generating code:", error)
    return { success: false, error: "Failed to generate code" }
  }
}

// Optimize supply chain
export async function optimizeSupplyChain({
  items,
  packages,
  origin,
  destination,
}: {
  items: string
  packages: string
  origin: string
  destination: string
}) {
  try {
    const optimizer = new SupplyChainOptimizer()

    // Parse the inputs
    const parsedItems = JSON.parse(items)
    const parsedPackages = packages ? JSON.parse(packages) : []
    const parsedOrigin = JSON.parse(origin)
    const parsedDestination = JSON.parse(destination)

    // Optimize the supply chain
    const result = optimizer.optimizeSupplyChain(
      parsedItems,
      parsedPackages,
      parsedOrigin,
      parsedDestination,
      [], // No carriers provided
    )

    return { success: true, data: result }
  } catch (error) {
    console.error("Error optimizing supply chain:", error)
    return { success: false, error: "Failed to optimize supply chain" }
  }
}

// --- Database Connection Actions ---

// Fetch all database connections for the user
export async function getDatabaseConnections(): Promise<DatabaseConnection[]> {
  let supabase
  try {
    supabase = await createServerSupabaseClient()
  } catch (e: any) {
    console.error("Failed to create Supabase client in getDatabaseConnections:", e.message)
    throw new Error(`Server configuration error: ${e.message}`)
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) {
    console.error("Error getting user in getDatabaseConnections:", userError.message)
    throw new Error(`Authentication error: ${userError.message}`)
  }

  if (!user) {
    console.warn(
      "getDatabaseConnections: User not authenticated. Session might be invalid or cookies not properly handled.",
    )
    throw new Error("User not authenticated. Please log in again.")
  }

  console.log(`[Server Action] Fetching database connections for user: ${user.id}`)

  const { data, error: queryError } = await supabase
    .from("database_connections")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (queryError) {
    console.error("Error fetching database connections from Supabase for user " + user.id + ":", queryError)
    throw new Error(
      `Failed to fetch database connections: ${queryError.message}. (Code: ${queryError.code}, Details: ${queryError.details}, Hint: ${queryError.hint} - Check RLS, table existence, and network access.)`,
    )
  }

  console.log(`[Server Action] Successfully fetched ${data?.length || 0} database connections for user ${user.id}.`)
  return data as DatabaseConnection[]
}

export async function createDbConnection(
  formData: CreateDatabaseConnectionInput,
): Promise<{ success: boolean; data?: DatabaseConnection; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "User not authenticated" }
  }

  const validation = createDatabaseConnectionSchema.safeParse(formData)
  if (!validation.success) {
    return { success: false, error: validation.error.issues.map((e) => e.message).join(", ") }
  }

  // IMPORTANT: In a real application, encrypt `password` and `connection_string` before saving.
  // For example, using a dedicated encryption service or Supabase Vault.
  // This example does not implement encryption for brevity.
  const { data: newConnection, error } = await supabase
    .from("database_connections")
    .insert({ ...validation.data, user_id: user.id })
    .select()
    .single()

  if (error) {
    console.error("Error creating database connection:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/ai-suite/data-sources") // Assuming this will be the page
  return { success: true, data: newConnection as DatabaseConnection }
}

export async function updateDbConnection(
  formData: UpdateDatabaseConnectionInput & { id: string },
): Promise<{ success: boolean; data?: DatabaseConnection; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "User not authenticated" }
  }

  // The id is now part of formData, so we can validate it directly
  const validation = updateDatabaseConnectionSchema.safeParse(formData)
  if (!validation.success) {
    return { success: false, error: validation.error.issues.map((e) => e.message).join(", ") }
  }

  const { id, ...updateData } = validation.data

  // IMPORTANT: Handle encryption if password/connection_string is being updated.
  const { data: updatedConnection, error } = await supabase
    .from("database_connections")
    .update({ ...updateData, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id) // Ensure user owns the connection
    .select()
    .single()

  if (error) {
    console.error("Error updating database connection:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/ai-suite/data-sources")
  return { success: true, data: updatedConnection as DatabaseConnection }
}

export async function deleteDbConnection(connectionId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "User not authenticated" }
  }

  const { error } = await supabase.from("database_connections").delete().eq("id", connectionId).eq("user_id", user.id)

  if (error) {
    console.error("Error deleting database connection:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/ai-suite/data-sources")
  return { success: true }
}

export async function testDbConnection(
  connectionId: string,
): Promise<{ success: boolean; message?: string; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "User not authenticated" }
  }

  const { data: connection, error: fetchError } = await supabase
    .from("database_connections")
    .select("connection_type, host, port, database_name, username, password, connection_string, additional_params") // Fetch necessary fields
    .eq("id", connectionId)
    .eq("user_id", user.id)
    .single()

  if (fetchError || !connection) {
    await supabase
      .from("database_connections")
      .update({
        last_tested_at: new Date().toISOString(),
        last_test_status: "failed",
        last_test_error: "Connection not found or access denied.",
      })
      .eq("id", connectionId)
    return { success: false, error: "Connection not found or access denied." }
  }

  // !!! IMPORTANT: Actual database connection logic is complex and environment-dependent.
  // !!! This part is a placeholder for Next.js.
  // !!! In a full backend, you'd use libraries like 'pg', 'mysql2', etc.
  // !!! and handle potential network/security issues.
  // !!! For `Next.js`, direct external DB connections from server actions are challenging.
  // !!! This would typically be handled by a separate backend API or Vercel Function.

  console.log(`Simulating test for connection ID: ${connectionId}, Type: ${connection.connection_type}`)
  // Simulate a delay
  await new Promise((resolve) => setTimeout(resolve, 1500))

  // Placeholder: Simulate success for PostgreSQL, failure for others for demonstration
  let testSuccessful = connection.connection_type === "postgresql"
  let testError = testSuccessful ? null : "Simulated connection failure: Unsupported type or invalid credentials."

  try {
    // Example: if (connection.connection_type === 'postgresql') {
    //   const { Client } = require('pg'); // This won't work directly in Next.js sandbox easily
    //   const client = new Client({ /* connection details from `connection` object */ });
    //   await client.connect();
    //   await client.query('SELECT 1');
    //   await client.end();
    //   testSuccessful = true; testError = null;
    // } else { ... }
    // For now, we stick to simulation.
    if (connection.host && connection.host.includes("fail")) {
      // simple simulation
      testSuccessful = false
      testError = "Simulated connection failure: Hostname indicates failure."
    }
  } catch (e: any) {
    testSuccessful = false
    testError = e.message
  }

  await supabase
    .from("database_connections")
    .update({
      last_tested_at: new Date().toISOString(),
      last_test_status: testSuccessful ? "success" : "failed",
      last_test_error: testError,
    })
    .eq("id", connectionId)

  revalidatePath("/ai-suite/data-sources")
  if (testSuccessful) {
    return { success: true, message: "Connection test successful!" }
  } else {
    return { success: false, error: `Connection test failed: ${testError}` }
  }
}

// Action to fetch schema (tables, views) from a connected database
// Placeholder: This is highly complex and DB-specific.
export async function getDatabaseSchema(
  connectionId: string,
): Promise<{ success: boolean; data?: any; error?: string; message?: string }> {
  console.log(`Simulating schema fetch for connection ID: ${connectionId}`)
  // In a real app:
  // 1. Fetch connection details for connectionId.
  // 2. Connect to the external database.
  // 3. Run DB-specific queries to get schema (e.g., from information_schema).
  // 4. Return schema.
  await new Promise((resolve) => setTimeout(resolve, 1000))
  return {
    success: true,
    data: {
      tables: [
        { name: "public.users", columns: ["id", "name", "email", "created_at"] },
        { name: "public.orders", columns: ["id", "user_id", "product_id", "quantity", "order_date"] },
      ],
      views: [{ name: "public.user_order_summary", columns: ["user_id", "total_orders", "last_order_date"] }],
    },
    message: "Simulated schema fetched successfully.",
  }
}

// --- User Managed Supabase Project Actions ---

export async function createSupabaseProjectForUser(
  formData: CreateSupabaseProjectFormValues,
): Promise<{ success: boolean; data?: UserManagedSupabaseProject; error?: string; message?: string }> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "User not authenticated" }
  }

  const validation = createSupabaseProjectFormSchema.safeParse(formData)
  if (!validation.success) {
    return { success: false, error: validation.error.issues.map((e) => e.message).join(", ") }
  }

  const { displayName, supabaseProjectName, region, dbPass } = validation.data

  // In a real scenario, you would use these environment variables securely on your backend.
  const SUPABASE_MANAGEMENT_API_TOKEN = process.env.SUPABASE_MANAGEMENT_API_TOKEN
  const SUPABASE_ORGANIZATION_ID = process.env.SUPABASE_ORGANIZATION_ID

  if (!SUPABASE_MANAGEMENT_API_TOKEN || !SUPABASE_ORGANIZATION_ID) {
    console.error("Supabase Management API token or Organization ID is not configured.")
    return { success: false, error: "Platform configuration error. Cannot create database." }
  }

  // --- !!! IMPORTANT: API Call Simulation for next-lite !!! ---
  // next-lite cannot make arbitrary outbound API calls like a full Node.js backend.
  // The following is a conceptual representation of calling the Supabase Management API.
  // In a real deployment, you would use `fetch` here.

  console.log(`[SIMULATING] Calling Supabase Management API to create project: ${supabaseProjectName}`)
  console.log(`[SIMULATING] Org ID: ${SUPABASE_ORGANIZATION_ID}, Region: ${region}, Plan: free`)

  // Mocked successful response structure based on Supabase Management API Docs
  // In a real call:
  // const response = await fetch("https://api.supabase.com/v1/projects", {
  //   method: "POST",
  //   headers: {
  //     "Authorization": `Bearer ${SUPABASE_MANAGEMENT_API_TOKEN}`,
  //     "Content-Type": "application/json",
  //   },
  //   body: JSON.stringify({
  //     organization_id: SUPABASE_ORGANIZATION_ID,
  //     name: supabaseProjectName,
  //     db_pass: dbPass,
  //     region: region,
  //     plan: "free", // Hardcoding to 'free' tier for now
  //   }),
  // });
  // const supbaseApiResult = await response.json();
  // if (!response.ok) { /* handle error */ }

  // Simulated success:
  const mockSupabaseProjectId = uuidv4().substring(0, 8) // Mock project ID (integer in reality)
  const mockSupabaseProjectRef = supabaseProjectName.toLowerCase().replace(/\s+/g, "-") + "-" + uuidv4().substring(0, 6)
  const mockDbHost = `db.${mockSupabaseProjectRef}.supabase.co`
  const mockServiceRoleKey = `mock_service_role_key_${uuidv4()}`
  const mockAnonKey = `mock_anon_key_${uuidv4()}`

  const simulatedApiSuccess = true // Change to false to test error path

  if (!simulatedApiSuccess) {
    // Simulated error
    const errorMessage = "Simulated Supabase API error: Project name already taken."
    // Store provisional record with error
    await supabase.from("user_managed_supabase_projects").insert({
      user_id: user.id,
      display_name: displayName,
      supabase_project_id: `failed-${Date.now()}`, // Placeholder
      supabase_project_ref: `failed-${supabaseProjectName}`, // Placeholder
      supabase_region: region,
      supabase_plan: "free",
      status: "CREATION_FAILED",
      error_message: errorMessage,
    })
    return { success: false, error: errorMessage }
  }

  // --- End of API Call Simulation ---

  // IMPORTANT: Encrypt mockServiceRoleKey and mockAnonKey before storing in a real app.
  // For next-lite, we'll store them as-is, but this is NOT secure for production.
  const newManagedProjectData: CreateUserManagedSupabaseProjectInput = {
    user_id: user.id,
    display_name: displayName,
    supabase_project_id: mockSupabaseProjectId, // From actual API response: supbaseApiResult.id
    supabase_project_ref: mockSupabaseProjectRef, // Derived or from supbaseApiResult.reference_id or database.host
    supabase_region: region, // From actual API response: supbaseApiResult.region
    supabase_plan: "free", // From actual API response: supbaseApiResult.plan
    status: "ACTIVE", // Or "COMING_UP" then update via webhook/polling: supbaseApiResult.status
    db_host: mockDbHost, // From actual API response: supbaseApiResult.database.host
    encrypted_service_role_key: mockServiceRoleKey, // conceptual encryption
    encrypted_anon_key: mockAnonKey, // conceptual encryption
  }

  const { data: newProjectEntry, error: dbInsertError } = await supabase
    .from("user_managed_supabase_projects")
    .insert(newManagedProjectData)
    .select()
    .single()

  if (dbInsertError) {
    console.error("Error saving managed Supabase project metadata:", dbInsertError)
    // Potentially try to delete the Supabase project if DB insert fails
    return { success: false, error: `Failed to save project metadata: ${dbInsertError.message}` }
  }

  revalidatePath("/ai-suite/data-sources") // Or the new managed databases page path
  revalidatePath("/ai-suite/managed-databases")

  return {
    success: true,
    data: newProjectEntry as UserManagedSupabaseProject,
    message: `Database '${displayName}' is provisioning. It may take a few minutes to become fully active.`,
  }
}

export async function getManagedSupabaseProjectsForUser(): Promise<UserManagedSupabaseProject[]> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    console.warn("getManagedSupabaseProjectsForUser: User not authenticated.")
    return [] // Or throw error
  }

  const { data, error } = await supabase
    .from("user_managed_supabase_projects")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching managed Supabase projects:", error)
    return [] // Or throw error
  }
  return data as UserManagedSupabaseProject[]
}

export async function addManagedDbToConnections(
  managedProjectId: string,
): Promise<{ success: boolean; error?: string; message?: string }> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { success: false, error: "User not authenticated" }

  const { data: managedProject, error: fetchError } = await supabase
    .from("user_managed_supabase_projects")
    .select("*")
    .eq("id", managedProjectId)
    .eq("user_id", user.id)
    .single()

  if (fetchError || !managedProject) {
    return { success: false, error: "Managed database not found or access denied." }
  }

  if (managedProject.status !== "ACTIVE") {
    return { success: false, error: "Database is not yet active." }
  }

  // Conceptual decryption. In real app, use a secure decryption method.
  const serviceRoleKey = managedProject.encrypted_service_role_key
  if (!serviceRoleKey) {
    return { success: false, error: "Service role key not found for this managed database." }
  }

  const connectionData: CreateDatabaseConnectionInput = {
    user_id: user.id,
    name: `${managedProject.display_name} (Managed)`,
    description: `Managed Supabase project: ${managedProject.supabase_project_ref}`,
    connection_type: "postgresql", // Supabase uses PostgreSQL
    host: managedProject.db_host,
    port: 5432, // Default Supabase DB port
    database_name: "postgres", // Default Supabase DB name
    username: "postgres", // Default Supabase DB username
    // The 'password' for the connection is the service_role_key for Supabase
    password: serviceRoleKey, // This is the conceptually decrypted service_role_key
    ssl_mode: "require", // Supabase typically requires SSL
    is_active: true,
    // last_test_status and last_tested_at will be set upon first test
  }

  const { error: insertConnError } = await supabase.from("database_connections").insert(connectionData)

  if (insertConnError) {
    console.error("Error adding managed DB to connections:", insertConnError)
    if (insertConnError.code === "23505") {
      // unique constraint violation
      return { success: false, error: "This database connection already exists." }
    }
    return { success: false, error: `Failed to add to Data Sources: ${insertConnError.message}` }
  }

  revalidatePath("/ai-suite/data-sources")
  return { success: true, message: `${managedProject.display_name} added to Data Sources.` }
}
