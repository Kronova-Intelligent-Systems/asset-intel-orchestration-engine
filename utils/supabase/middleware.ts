import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

/**
 * Kronova Enterprise Middleware
 * OAuth 2.1, MCP Authentication, and AetherNet Route Handler
 */

interface RouteClassification {
  isPublic: boolean
  isOAuth: boolean
  isMCP: boolean
  isAetherNet: boolean
  isAPI: boolean
  requiresAuth: boolean
  requiresOAuthConsent: boolean
}

/**
 * Classify the incoming request route
 */
function classifyRoute(pathname: string): RouteClassification {
  const classification: RouteClassification = {
    isPublic: false,
    isOAuth: false,
    isMCP: false,
    isAetherNet: false,
    isAPI: false,
    requiresAuth: true,
    requiresOAuthConsent: false,
  }

  // OAuth 2.1 Server Routes
  const oauthRoutes = [
    "/api/v1/oauth/authorize",
    "/api/v1/oauth/token",
    "/api/v1/oauth/revoke",
    "/api/v1/oauth/introspect",
    "/api/v1/oauth/clients",
    "/api/v1/oauth/register",
    "/api/oauth/decision",
    "/oauth/consent",
    "/oauth/callback",
    "/oauth/authorize",
  ]

  // MCP (Model Context Protocol) Routes
  const mcpRoutes = [
    "/api/mcp/",
    "/.well-known/oauth-authorization-server",
    "/.well-known/mcp-configuration",
    "/api/v1/mcp/",
  ]

  // AetherNet P2P Protocol Routes
  const aetherNetRoutes = ["/api/aethernet/", "/api/v1/aethernet/", "/ai-suite/aethernet"]

  // Public routes (no auth required)
  const publicRoutes = [
    "/",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/about",
    "/docs",
    "/demo",
    "/p/",
    "/track/",
    "/auth/",
    "/test-public-card",
  ]

  // API routes that should skip session updates
  const apiRoutes = ["/api/"]

  // Check OAuth routes
  if (oauthRoutes.some((route) => pathname.startsWith(route) || pathname === route)) {
    classification.isOAuth = true
    // OAuth authorize and consent require user auth but are part of OAuth flow
    if (pathname.includes("/oauth/consent") || pathname.includes("/oauth/authorize")) {
      classification.requiresOAuthConsent = true
    }
    // Token and introspect endpoints don't require session auth (use client credentials)
    if (pathname.includes("/token") || pathname.includes("/introspect") || pathname.includes("/revoke")) {
      classification.requiresAuth = false
    }
  }

  // Check MCP routes
  if (mcpRoutes.some((route) => pathname.startsWith(route))) {
    classification.isMCP = true
    // MCP discovery endpoints are public
    if (pathname.includes(".well-known")) {
      classification.isPublic = true
      classification.requiresAuth = false
    }
  }

  // Check AetherNet routes
  if (aetherNetRoutes.some((route) => pathname.startsWith(route))) {
    classification.isAetherNet = true
    // AetherNet requires authentication
    classification.requiresAuth = true
  }

  // Check API routes
  if (apiRoutes.some((route) => pathname.startsWith(route))) {
    classification.isAPI = true
  }

  // Check public routes
  if (publicRoutes.some((route) => pathname.startsWith(route) || pathname === route)) {
    classification.isPublic = true
    classification.requiresAuth = false
  }

  // Static assets are always public
  if (pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js|woff|woff2|ttf|eot)$/)) {
    classification.isPublic = true
    classification.requiresAuth = false
  }

  return classification
}

/**
 * Extract OAuth 2.1 parameters from request
 */
function extractOAuthParams(request: NextRequest): Record<string, string | null> {
  const { searchParams } = new URL(request.url)
  return {
    client_id: searchParams.get("client_id"),
    redirect_uri: searchParams.get("redirect_uri"),
    response_type: searchParams.get("response_type"),
    scope: searchParams.get("scope"),
    state: searchParams.get("state"),
    code_challenge: searchParams.get("code_challenge"),
    code_challenge_method: searchParams.get("code_challenge_method"),
    authorization_id: searchParams.get("authorization_id"),
    oauth_request: searchParams.get("oauth_request"),
  }
}

/**
 * Validate OAuth 2.1 PKCE parameters
 */
function validatePKCE(params: Record<string, string | null>): { valid: boolean; error?: string } {
  if (params.response_type === "code") {
    if (!params.code_challenge) {
      return { valid: false, error: "PKCE code_challenge is required for OAuth 2.1" }
    }
    if (params.code_challenge_method !== "S256") {
      return { valid: false, error: "Only S256 code_challenge_method is supported" }
    }
  }
  return { valid: true }
}

/**
 * Handle OAuth consent flow routing
 */
function handleOAuthConsentRouting(
  request: NextRequest,
  user: any,
  oauthParams: Record<string, string | null>,
): NextResponse | null {
  const pathname = request.nextUrl.pathname

  // If accessing consent page without auth, redirect to login with OAuth context
  if (pathname.includes("/oauth/consent") && !user) {
    const authorizationId = oauthParams.authorization_id
    if (authorizationId) {
      const loginUrl = new URL("/login", request.url)
      loginUrl.searchParams.set("redirect", `/oauth/consent?authorization_id=${authorizationId}`)
      return NextResponse.redirect(loginUrl)
    }
  }

  // If accessing authorize endpoint without auth, store request and redirect
  if (pathname.includes("/authorize") && !user && oauthParams.client_id) {
    const loginUrl = new URL("/login", request.url)
    // Preserve OAuth parameters for post-login redirect
    const returnUrl = new URL(request.url)
    loginUrl.searchParams.set("redirect", returnUrl.pathname + returnUrl.search)
    return NextResponse.redirect(loginUrl)
  }

  return null
}

/**
 * Add security headers for OAuth/MCP responses
 */
function addSecurityHeaders(response: NextResponse, classification: RouteClassification): NextResponse {
  // Standard security headers
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("X-XSS-Protection", "1; mode=block")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")

  // OAuth-specific headers
  if (classification.isOAuth) {
    response.headers.set("Cache-Control", "no-store")
    response.headers.set("Pragma", "no-cache")
  }

  // MCP discovery endpoints need CORS
  if (classification.isMCP && classification.isPublic) {
    response.headers.set("Access-Control-Allow-Origin", "*")
    response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS")
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization")
  }

  // AetherNet routes need specific headers
  if (classification.isAetherNet) {
    response.headers.set("X-AetherNet-Protocol", "v1")
  }

  return response
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const classification = classifyRoute(pathname)
  const oauthParams = extractOAuthParams(request)

  try {
    let supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
          },
        },
      },
    )

    let user = null

    // Skip auth entirely for public routes to avoid AbortErrors
    if (classification.isPublic && !classification.requiresOAuthConsent) {
      // For truly public routes (landing page, docs, etc.), skip auth check completely
      return addSecurityHeaders(supabaseResponse, classification)
    }

    // Only fetch user for routes that need session validation
    if (classification.requiresAuth || classification.requiresOAuthConsent) {
      try {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser()

        user = authUser
      } catch (authError: any) {
        // Handle auth errors gracefully
        console.log("[Kronova] Auth error in middleware:", authError?.message || "Unknown error")

        // Clear auth cookies on error for protected routes
        if (classification.requiresAuth) {
          const authCookies = ["sb-access-token", "sb-refresh-token", "supabase-auth-token"]
          authCookies.forEach((cookieName) => {
            supabaseResponse.cookies.delete(cookieName)
          })

          request.cookies.getAll().forEach((cookie) => {
            if (cookie.name.includes("supabase") || cookie.name.includes("sb-")) {
              supabaseResponse.cookies.delete(cookie.name)
            }
          })
        }

        user = null
      }
    }

    // Handle OAuth consent flow routing
    if (classification.isOAuth || classification.requiresOAuthConsent) {
      // Validate PKCE for authorization requests
      if (oauthParams.response_type === "code") {
        const pkceValidation = validatePKCE(oauthParams)
        if (!pkceValidation.valid) {
          return NextResponse.json(
            { error: "invalid_request", error_description: pkceValidation.error },
            { status: 400 },
          )
        }
      }

      const oauthRedirect = handleOAuthConsentRouting(request, user, oauthParams)
      if (oauthRedirect) {
        return addSecurityHeaders(oauthRedirect, classification)
      }
    }

    // Handle post-login OAuth redirect
    if (pathname === "/login" && oauthParams.oauth_request && user) {
      // User is already logged in and has pending OAuth request
      const consentUrl = new URL("/oauth/consent", request.url)
      consentUrl.searchParams.set("authorization_id", oauthParams.oauth_request)
      return NextResponse.redirect(consentUrl)
    }

    // Add security headers and return
    return addSecurityHeaders(supabaseResponse, classification)
  } catch (error) {
    console.error("[Kronova] Middleware: Unexpected error:", error)
    return NextResponse.next({ request })
  }
}
