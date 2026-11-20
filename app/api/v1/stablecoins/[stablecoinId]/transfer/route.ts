import { type NextRequest, NextResponse } from "next/server"
import { validateAPIRequest } from "@/lib/auth/api-auth"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createStablecoinManager } from "@/lib/blockchain/private-stablecoin"
import { z } from "zod"

const transferSchema = z.object({
  amount: z.string(),
  targetAddress: z.string(),
})

// POST /api/v1/stablecoins/[stablecoinId]/transfer - Transfer tokens
export async function POST(request: NextRequest, { params }: { params: Promise<{ stablecoinId: string }> }) {
  try {
    const { stablecoinId } = await params
    const auth = await validateAPIRequest(request, ["stablecoins:write"])
    if (!auth.authenticated) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const body = await request.json()
    const validated = transferSchema.parse(body)

    const supabase = await createServerSupabaseClient()
    const manager = createStablecoinManager(supabase)

    const result = await manager.transferTokens({
      stablecoinId,
      operationType: "transfer",
      amount: validated.amount,
      targetAddress: validated.targetAddress,
    })

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      data: {
        transactionId: result.transactionId,
      },
    })
  } catch (error) {
    console.error("[API] Transfer error:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Validation failed", details: error.issues }, { status: 400 })
    }

    return NextResponse.json({ success: false, error: "Failed to transfer tokens" }, { status: 500 })
  }
}
