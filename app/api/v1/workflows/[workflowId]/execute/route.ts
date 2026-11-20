import { type NextRequest, NextResponse, after } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { WorkflowSystem } from "@/lib/workflows/workflow-system"
import { triggerWebhooks } from "@/lib/webhooks/webhook-delivery"

async function validateAPIKeyForExecution(apiKey: string) {
  const supabase = await createServerSupabaseClient()

  const { data: validationResult, error: validationError } = await supabase.rpc("validate_api_key", {
    api_key: apiKey,
  })

  if (validationError || !validationResult || validationResult.length === 0) {
    return { valid: false, error: "Invalid API key", status: 401 }
  }

  const result = validationResult[0]

  if (!result.valid) {
    return { valid: false, error: "Invalid or expired API key", status: 401 }
  }

  // Check if key has execute:workflows scope
  const scopes = result.scopes || []
  if (!scopes.includes("execute:workflows") && !scopes.includes("execute:*")) {
    return {
      valid: false,
      error: "API key does not have permission to execute workflows. Required scope: execute:workflows",
      status: 403,
    }
  }

  return { valid: true, userId: result.user_id, apiKeyId: result.api_key_id }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ workflowId: string }> }) {
  const startTime = Date.now()
  const { workflowId } = await params

  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          error: "Missing or invalid Authorization header",
          message: "Please provide a valid API key in the format: Authorization: Bearer <your-api-key>",
        },
        { status: 401 },
      )
    }

    const apiKey = authHeader.substring(7)
    const validation = await validateAPIKeyForExecution(apiKey)

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: validation.status })
    }

    const userId = validation.userId!
    const apiKeyId = validation.apiKeyId!
    const supabase = await createServerSupabaseClient()

    const body = await request.json()
    const { input = {}, webhookUrl, metadata = {} } = body

    if (input && typeof input !== "object") {
      return NextResponse.json(
        {
          error: "Invalid field: input",
          message: "The 'input' field must be an object",
        },
        { status: 400 },
      )
    }

    const { data: workflow, error: workflowError } = await supabase
      .from("ai_workflows")
      .select("*")
      .eq("id", workflowId)
      .eq("user_id", userId)
      .maybeSingle()

    if (workflowError) {
      console.error("Error fetching workflow:", workflowError)
      return NextResponse.json(
        {
          error: "Failed to fetch workflow",
          message: "An error occurred while retrieving the workflow",
        },
        { status: 500 },
      )
    }

    if (!workflow) {
      return NextResponse.json(
        {
          error: "Workflow not found or access denied",
          message: `No workflow found with ID ${workflowId} for your account`,
        },
        { status: 404 },
      )
    }

    if (!workflow.is_active) {
      return NextResponse.json(
        {
          error: "Workflow is not active",
          message: "This workflow has been deactivated and cannot be executed",
        },
        { status: 403 },
      )
    }

    const workflowSystem = new WorkflowSystem(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    let result
    let runStatus = "completed"
    let errorMessage = null

    try {
      result = await workflowSystem.executeWorkflow(workflowId, userId, input)
    } catch (error) {
      console.error("Workflow execution error:", error)
      runStatus = "failed"
      errorMessage = error instanceof Error ? error.message : "Unknown error"
      result = {
        workflow_id: workflowId,
        status: "failed",
        error: errorMessage,
        execution_time: Date.now() - startTime,
      }
    }

    const executionTime = Date.now() - startTime

    const { data: executionRecord } = await supabase
      .from("ai_workflow_runs")
      .insert({
        workflow_id: workflowId,
        user_id: userId,
        status: runStatus,
        start_time: new Date(startTime).toISOString(),
        end_time: new Date().toISOString(),
        results: result,
        error: errorMessage,
        metadata: {
          executedViaApi: true,
          apiKeyId,
          executionTimeMs: executionTime,
          input,
          ...metadata,
        },
      })
      .select()
      .single()

    await supabase
      .from("ai_workflows")
      .update({
        last_executed_at: new Date().toISOString(),
        execution_count: (workflow.execution_count || 0) + 1,
      })
      .eq("id", workflowId)

    const webhookEvent = runStatus === "completed" ? "workflow.execution.completed" : "workflow.execution.failed"

    // Delivered after the response is sent; `after` keeps the function alive for retries.
    after(() =>
      triggerWebhooks({
        userId,
        event: webhookEvent,
        webhookUrl,
        payload: {
          workflowId,
          workflowName: workflow.name,
          executionId: executionRecord?.id,
          status: runStatus,
          result: result,
          error: errorMessage,
          executionTime: executionTime,
          timestamp: new Date().toISOString(),
        },
      }),
    )

    if (runStatus === "failed") {
      return NextResponse.json(
        {
          success: false,
          executionId: executionRecord?.id,
          workflowId: workflowId,
          workflowName: workflow.name,
          status: runStatus,
          error: errorMessage,
          executionTime: executionTime,
          timestamp: new Date().toISOString(),
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      executionId: executionRecord?.id,
      workflowId: workflowId,
      workflowName: workflow.name,
      status: runStatus,
      result: result,
      executionTime: executionTime,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error executing workflow via API:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "An unexpected error occurred",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
