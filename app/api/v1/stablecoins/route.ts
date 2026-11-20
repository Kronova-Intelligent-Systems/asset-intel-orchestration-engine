import { type NextRequest, NextResponse } from "next/server"
import { validateAPIRequest } from "@/lib/auth/api-auth"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createStablecoinManager } from "@/lib/blockchain/private-stablecoin"
import { stablecoinConfigSchema } from "@/lib/blockchain/canton-client"
import { z } from "zod"

const createStablecoinSchema = z.object({
  config: stablecoinConfigSchema,
  organizationId: z.string().uuid().optional(),
  initialMint: z.string().optional(),
  reserveWalletAddress: z.string().optional(),
})

// GET /api/v1/stablecoins - List user's stablecoins
export async function GET(request: NextRequest) {
  try {
    const auth = await validateAPIRequest(request, ["stablecoins:read"])
    if (!auth.authenticated) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const supabase = await createServerSupabaseClient()
    const manager = createStablecoinManager(supabase)

    const stablecoins = await manager.getUserStablecoins(auth.userId!)

    return NextResponse.json({
      success: true,
      data: stablecoins,
      meta: {
        total: stablecoins.length,
      },
    })
  } catch (error) {
    console.error("[API] Get stablecoins error:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch stablecoins" }, { status: 500 })
  }
}

// POST /api/v1/stablecoins - Deploy new stablecoin
export async function POST(request: NextRequest) {
  try {
    const auth = await validateAPIRequest(request, ["stablecoins:write"])
    if (!auth.authenticated) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const body = await request.json()
    const validated = createStablecoinSchema.parse(body)

    const supabase = await createServerSupabaseClient()
    const manager = createStablecoinManager(supabase)

    const result = await manager.deployStablecoin({
      userId: auth.userId!,
      organizationId: validated.organizationId,
      config: validated.config,
      initialMint: validated.initialMint,
      reserveWalletAddress: validated.reserveWalletAddress,
    })

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          stablecoinId: result.stablecoinId,
          contractId: result.contractId,
        },
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("[API] Deploy stablecoin error:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Validation failed", details: error.issues }, { status: 400 })
    }

    return NextResponse.json({ success: false, error: "Failed to deploy stablecoin" }, { status: 500 })
  }
}
