import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerSupabaseClient } from "@/lib/supabase/server"

// Initialize Supabase client for Edge Functions
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing Supabase environment variables")
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// This proxy forwards arbitrary caller input straight into a service-role
// Edge Function invocation. It must never be usable to reach a function
// that performs privileged, value-moving, or credential-issuing operations
// (those have their own dedicated, ownership-checked API routes) — a
// generic passthrough is the wrong place to enforce per-operation
// authorization. Deny them here regardless of caller auth state.
const BLOCKED_FUNCTIONS = new Set([
  "stablecoin-operations",
  "tokenize-asset",
  "process-ap2-mandate",
  "oauth-introspect",
])

// Helper function to get the function name from the slug
function getFunctionName(slug: string[]): string {
  return slug.join("/")
}

async function authorizeRequest(functionName: string): Promise<NextResponse | null> {
  if (BLOCKED_FUNCTIONS.has(functionName)) {
    return NextResponse.json(
      { error: `Function '${functionName}' is not accessible via the generic Edge Function proxy` },
      { status: 403 },
    )
  }

  const supabaseSSR = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabaseSSR.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }

  return null
}

// Helper function to invoke Supabase Edge Function
async function invokeEdgeFunction(functionName: string, payload: any, headers: Record<string, string>) {
  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: payload,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    })

    if (error) {
      console.error(`Error invoking function ${functionName}:`, error)
      return {
        success: false,
        error: error.message || "Function invocation failed",
        details: error,
      }
    }

    return {
      success: true,
      data,
    }
  } catch (error) {
    console.error(`Exception invoking function ${functionName}:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    }
  }
}

// GET handler
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  try {
    const resolvedParams = await params
    const functionName = getFunctionName(resolvedParams.slug)

    const authError = await authorizeRequest(functionName)
    if (authError) return authError

    // Extract query parameters
    const searchParams = request.nextUrl.searchParams
    const queryParams = Object.fromEntries(searchParams.entries())

    // Extract headers (filter out Next.js internal headers)
    const headers: Record<string, string> = {}
    request.headers.forEach((value, key) => {
      if (!key.startsWith("x-") && !key.startsWith("next-")) {
        headers[key] = value
      }
    })

    console.log(`Invoking Edge Function: ${functionName} (GET)`)

    const result = await invokeEdgeFunction(functionName, queryParams, headers)

    if (!result.success) {
      return NextResponse.json({ error: result.error, details: result.details }, { status: 500 })
    }

    return NextResponse.json(result.data)
  } catch (error) {
    console.error("GET request error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST handler
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  try {
    const resolvedParams = await params
    const functionName = getFunctionName(resolvedParams.slug)

    const authError = await authorizeRequest(functionName)
    if (authError) return authError

    // Parse request body
    let payload: any = {}
    try {
      const body = await request.text()
      payload = body ? JSON.parse(body) : {}
    } catch (parseError) {
      console.error("Error parsing request body:", parseError)
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })
    }

    // Extract headers (filter out Next.js internal headers)
    const headers: Record<string, string> = {}
    request.headers.forEach((value, key) => {
      if (!key.startsWith("x-") && !key.startsWith("next-")) {
        headers[key] = value
      }
    })

    console.log(`Invoking Edge Function: ${functionName} (POST)`)

    const result = await invokeEdgeFunction(functionName, payload, headers)

    if (!result.success) {
      return NextResponse.json({ error: result.error, details: result.details }, { status: 500 })
    }

    return NextResponse.json(result.data)
  } catch (error) {
    console.error("POST request error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT handler
export async function PUT(request: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  try {
    const resolvedParams = await params
    const functionName = getFunctionName(resolvedParams.slug)

    const authError = await authorizeRequest(functionName)
    if (authError) return authError

    // Parse request body
    let payload: any = {}
    try {
      const body = await request.text()
      payload = body ? JSON.parse(body) : {}
    } catch (parseError) {
      console.error("Error parsing request body:", parseError)
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })
    }

    // Extract headers
    const headers: Record<string, string> = {}
    request.headers.forEach((value, key) => {
      if (!key.startsWith("x-") && !key.startsWith("next-")) {
        headers[key] = value
      }
    })

    console.log(`Invoking Edge Function: ${functionName} (PUT)`)

    const result = await invokeEdgeFunction(functionName, payload, headers)

    if (!result.success) {
      return NextResponse.json({ error: result.error, details: result.details }, { status: 500 })
    }

    return NextResponse.json(result.data)
  } catch (error) {
    console.error("PUT request error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE handler
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  try {
    const resolvedParams = await params
    const functionName = getFunctionName(resolvedParams.slug)

    const authError = await authorizeRequest(functionName)
    if (authError) return authError

    // Extract query parameters for DELETE requests
    const searchParams = request.nextUrl.searchParams
    const queryParams = Object.fromEntries(searchParams.entries())

    // Extract headers
    const headers: Record<string, string> = {}
    request.headers.forEach((value, key) => {
      if (!key.startsWith("x-") && !key.startsWith("next-")) {
        headers[key] = value
      }
    })

    console.log(`Invoking Edge Function: ${functionName} (DELETE)`)

    const result = await invokeEdgeFunction(functionName, queryParams, headers)

    if (!result.success) {
      return NextResponse.json({ error: result.error, details: result.details }, { status: 500 })
    }

    return NextResponse.json(result.data)
  } catch (error) {
    console.error("DELETE request error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// OPTIONS handler for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey",
    },
  })
}
