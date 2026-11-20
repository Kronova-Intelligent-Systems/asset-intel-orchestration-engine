import { NextRequest, NextResponse } from "next/server"
import { AGENT_CARD_HEADERS, buildPlatformAgentCard } from "@/lib/a2a/platform-agent-card"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  return NextResponse.json(buildPlatformAgentCard(request), { headers: AGENT_CARD_HEADERS })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: AGENT_CARD_HEADERS })
}
