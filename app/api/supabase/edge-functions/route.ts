import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerSupabaseClient } from "@/lib/supabase/server"

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing Supabase environment variables")
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// See app/api/supabase/functions/[...slug]/route.ts for why these are
// blocked unconditionally: this proxy invokes any named function with the
// service-role key on the caller's behalf, so it must never be able to
// reach a function with privileged, value-moving, or credential-issuing
// side effects — those already have their own dedicated, ownership-checked
// API routes.
const BLOCKED_FUNCTIONS = new Set([
  "stablecoin-operations",
  "tokenize-asset",
  "process-ap2-mandate",
  "oauth-introspect",
])

// GET - List available Edge Functions
export async function GET() {
  try {
    // This is a utility endpoint to list available functions
    // In a real implementation, you might want to maintain a registry
    // or fetch this information from Supabase
    const availableFunctions = [
      {
        name: "process-database-embeddings",
        description: "Process database embeddings for AI operations",
        methods: ["POST"],
        endpoint: "/api/supabase/functions/process-database-embeddings",
      },
      // Add more functions as you create them
    ]

    return NextResponse.json({
      success: true,
      functions: availableFunctions,
      usage: {
        description: "Use /api/supabase/functions/[function-name] to invoke specific Edge Functions",
        example: "POST /api/supabase/functions/process-database-embeddings",
      },
    })
  } catch (error) {
    console.error("Error listing Edge Functions:", error)
    return NextResponse.json({ error: "Failed to list Edge Functions" }, { status: 500 })
  }
}

// POST - Generic function invoker (alternative interface)
export async function POST(request: NextRequest) {
  try {
    const { functionName, payload, method = "POST" } = await request.json()

    if (!functionName) {
      return NextResponse.json({ error: "functionName is required" }, { status: 400 })
    }

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

    console.log(`Invoking Edge Function: ${functionName} via generic invoker`)

    const { data, error } = await supabase.functions.invoke(functionName, {
      body: payload,
      headers: {
        "Content-Type": "application/json",
      },
    })

    if (error) {
      console.error(`Error invoking function ${functionName}:`, error)
      return NextResponse.json({ error: error.message || "Function invocation failed" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data,
      functionName,
      invokedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Generic function invoker error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
