import { NextResponse, type NextRequest } from "next/server"
import { updateSession } from "@/utils/supabase/middleware"

/**
 * Kronova Enterprise Proxy Middleware
 * Handles OAuth 2.1 Server, MCP Authentication, and AetherNet Protocol routing
 */

const ROUTE_MATCHERS = {
  // OAuth 2.1 Server endpoints
  oauth: ["/api/v1/oauth/", "/api/oauth/", "/oauth/"],

  // MCP (Model Context Protocol) endpoints
  mcp: [
    "/api/mcp/",
    "/api/v1/mcp/",
    "/.well-known/oauth-authorization-server",
    "/.well-known/mcp-configuration",
    "/.well-known/openid-configuration",
  ],

  // AetherNet P2P Protocol endpoints
  aethernet: ["/api/aethernet/", "/api/v1/aethernet/", "/ai-suite/aethernet"],

  // Public routes (no auth required)
  public: [
    "/p/",
    "/api/check-profile",
    "/api/debug-profile",
    "/api/fix-profiles",
    "/api/fix-specific-profile",
    "/test-public-card",
    "/login",
    "/",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/about",
    "/platform",
    "/docs",
    "/demo",
    "/track/",
    "/auth/",
  ],

  // Static assets
  static: /\.(ico|png|jpg|jpeg|svg|css|js|woff|woff2|ttf|eot|webp|gif)$/,
}

const A2A_AGENT_CARD_PATHS = ["/.well-known/agent.json", "/.well-known/agent-card.json"]

/**
 * Check if route matches any pattern in a list
 */
function matchesRoute(pathname: string, patterns: string[]): boolean {
  return patterns.some((pattern) => pathname === pattern || pathname.startsWith(pattern))
}

/**
 * Determine route type for logging and metrics
 */
function getRouteType(pathname: string): string {
  if (matchesRoute(pathname, ROUTE_MATCHERS.oauth)) return "oauth"
  if (matchesRoute(pathname, ROUTE_MATCHERS.mcp)) return "mcp"
  if (matchesRoute(pathname, ROUTE_MATCHERS.aethernet)) return "aethernet"
  if (matchesRoute(pathname, ROUTE_MATCHERS.public)) return "public"
  if (ROUTE_MATCHERS.static.test(pathname)) return "static"
  return "protected"
}

/**
 * Handle MCP discovery endpoints
 * These must return specific JSON-LD formatted responses
 */
async function handleMCPDiscovery(request: NextRequest): Promise<NextResponse | null> {
  const pathname = request.nextUrl.pathname
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin

  // OAuth Authorization Server Metadata (RFC 8414)
  if (pathname === "/.well-known/oauth-authorization-server") {
    return NextResponse.json(
      {
        issuer: baseUrl,
        authorization_endpoint: `${baseUrl}/api/v1/oauth/authorize`,
        token_endpoint: `${baseUrl}/api/v1/oauth/token`,
        revocation_endpoint: `${baseUrl}/api/v1/oauth/revoke`,
        introspection_endpoint: `${baseUrl}/api/v1/oauth/introspect`,
        registration_endpoint: `${baseUrl}/api/v1/oauth/clients`,
        jwks_uri: `${baseUrl}/.well-known/jwks.json`,
        response_types_supported: ["code"],
        response_modes_supported: ["query"],
        grant_types_supported: ["authorization_code", "refresh_token", "client_credentials"],
        token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post", "none"],
        code_challenge_methods_supported: ["S256"],
        scopes_supported: [
          "openid",
          "profile",
          "email",
          "read:assets",
          "write:assets",
          "read:agents",
          "write:agents",
          "execute_agents",
          "read:oauth",
          "write:oauth",
          "aethernet:read",
          "aethernet:write",
          "mcp:execute",
        ],
        ui_locales_supported: ["en"],
        service_documentation: `${baseUrl}/docs`,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=3600",
          "Access-Control-Allow-Origin": "*",
        },
      },
    )
  }

  // MCP Configuration Discovery
  if (pathname === "/.well-known/mcp-configuration") {
    return NextResponse.json(
      {
        name: "Kronova MCP Server",
        version: "1.0.0",
        protocol_version: "2024-11-05",
        capabilities: {
          tools: true,
          resources: true,
          prompts: true,
          sampling: false,
        },
        authentication: {
          type: "oauth2",
          oauth_authorization_server: `${baseUrl}/.well-known/oauth-authorization-server`,
          required_scopes: ["mcp:execute"],
        },
        endpoints: {
          tools: `${baseUrl}/api/v1/mcp/tools`,
          resources: `${baseUrl}/api/v1/mcp/resources`,
          prompts: `${baseUrl}/api/v1/mcp/prompts`,
          execute: `${baseUrl}/api/v1/mcp/execute`,
        },
        aethernet: {
          enabled: true,
          protocol_version: "v1",
          messaging_endpoint: `${baseUrl}/api/v1/aethernet/messages`,
          p2p_enabled: true,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=3600",
          "Access-Control-Allow-Origin": "*",
        },
      },
    )
  }

  return null
}

/**
 * Handle CORS preflight for OAuth/MCP endpoints
 */
function handleCORSPreflight(request: NextRequest): NextResponse | null {
  if (request.method !== "OPTIONS") return null

  const pathname = request.nextUrl.pathname
  const isOAuthOrMCP = matchesRoute(pathname, [...ROUTE_MATCHERS.oauth, ...ROUTE_MATCHERS.mcp])

  if (isOAuthOrMCP) {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
        "Access-Control-Max-Age": "86400",
      },
    })
  }

  return null
}

/**
 * Add request context headers for downstream processing
 */
function addRequestContext(response: NextResponse, routeType: string): NextResponse {
  response.headers.set("X-Kronova-Route-Type", routeType)
  response.headers.set("X-Kronova-Timestamp", new Date().toISOString())
  response.headers.set("X-Robots-Tag", "noindex, nofollow")

  // Add CSP for OAuth consent pages
  if (routeType === "oauth") {
    response.headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
    )
  }

  return response
}

export default async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const routeType = getRouteType(pathname)

  // Handle CORS preflight requests
  const corsResponse = handleCORSPreflight(request)
  if (corsResponse) return corsResponse

  // Handle MCP discovery endpoints directly
  const mcpDiscoveryResponse = await handleMCPDiscovery(request)
  if (mcpDiscoveryResponse) return mcpDiscoveryResponse

  // A2A Agent Card is public discovery metadata served by its own route handler
  if (A2A_AGENT_CARD_PATHS.includes(pathname)) return NextResponse.next()

  // Check if it's a public route
  const isPublicRoute = matchesRoute(pathname, ROUTE_MATCHERS.public) || ROUTE_MATCHERS.static.test(pathname)

  // Process through Supabase session middleware
  const response = await updateSession(request)

  // Add request context
  return addRequestContext(response, routeType)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     *
     * Include OAuth, MCP, and AetherNet routes explicitly
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    // Explicitly include well-known routes for MCP discovery
    "/.well-known/:path*",
  ],
}
