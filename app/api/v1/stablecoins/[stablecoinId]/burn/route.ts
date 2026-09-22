import { type NextRequest, NextResponse } from "next/server"
import { validateAPIRequest } from "@/lib/auth/api-auth"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createStablecoinManager } from "@/lib/blockchain/private-stablecoin"
import { z } from "zod"

const burnSchema = z.object({
  amount: z.string().regex(/^[1-9][0-9]*$/, "Amount must be a positive whole number"),
  reason: z.string().optional(),
})

// POST /api/v1/stablecoins/[stablecoinId]/burn - Burn tokens
export async function POST(request: NextRequest, { params }: { params: Promise<{ stablecoinId: string }> }) {
  try {
    const { stablecoinId } = await params
    const auth = await validateAPIRequest(request, ["stablecoins:write"])
    if (!auth.authenticated) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const body = await request.json()
    const validated = burnSchema.parse(body)

    const supabase = await createServerSupabaseClient()
    const manager = createStablecoinManager(supabase)

    // Verify ownership
    const stablecoin = await manager.getStablecoin(stablecoinId)
    if (!stablecoin || stablecoin.user_id !== auth.userId) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 })
    }

    const result = await manager.burnTokens({
      stablecoinId,
      operationType: "burn",
      amount: validated.amount,
      reason: validated.reason,
    })

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      data: {
        transactionId: result.transactionId,
        newSupply: result.newSupply,
      },
    })
  } catch (error) {
    console.error("[API] Burn error:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Validation failed", details: error.errors }, { status: 400 })
    }

    return NextResponse.json({ success: false, error: "Failed to burn tokens" }, { status: 500 })
  }
}
