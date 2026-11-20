import { createClientSupabaseClient } from "@/lib/supabase/client"

/**
 * MCP OAuth 2.1 Client for Model Context Protocol Authentication
 * Reference: https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication
 *
 * Supabase provides native OAuth 2.1 server functionality that MCP clients can use.
 * This module provides helpers for interacting with Supabase's OAuth endpoints.
 */

export interface MCPOAuthClient {
  client_id: string
  client_secret?: string // Only for confidential clients
  client_name: string
  client_description?: string
  client_type: "public" | "confidential"
  redirect_uris: string[]
  allowed_scopes: string[]
  created_at: string
  is_active: boolean
}

export interface MCPAuthorizationRequest {
  client_id: string
  redirect_uri: string
  scope: string[]
  code_challenge: string
  code_challenge_method: "S256" | "plain"
  state?: string
}

export interface MCPTokenResponse {
  access_token: string
  refresh_token: string
  token_type: "Bearer"
  expires_in: number
  scope: string[]
}

/**
 * Register a new MCP OAuth client (dynamic registration)
 */
export async function registerMCPClient(params: {
  client_name: string
  client_description?: string
  redirect_uris: string[]
  allowed_scopes: string[]
  client_type: "public" | "confidential"
}): Promise<{ success: boolean; data?: MCPOAuthClient; error?: string }> {
  try {
    const supabase = createClientSupabaseClient()

    const { data, error } = await supabase.rpc("register_oauth_client", {
      p_client_name: params.client_name,
      p_client_description: params.client_description,
      p_redirect_uris: params.redirect_uris,
      p_allowed_scopes: params.allowed_scopes,
      p_client_type: params.client_type,
    })

    if (error) {
      console.error("[v0] Error registering MCP client:", error)
      return { success: false, error: error.message }
    }

    return { success: true, data: data as MCPOAuthClient }
  } catch (error: any) {
    console.error("[v0] Exception registering MCP client:", error)
    return { success: false, error: error.message }
  }
}

/**
 * List user's OAuth clients
 */
export async function listMCPClients(): Promise<{
  success: boolean
  data?: MCPOAuthClient[]
  error?: string
}> {
  try {
    const supabase = createClientSupabaseClient()

    const { data, error } = await supabase.from("oauth_clients").select("*").order("created_at", { ascending: false })

    if (error) {
      console.error("[v0] Error listing MCP clients:", error)
      return { success: false, error: error.message }
    }

    return { success: true, data: data as MCPOAuthClient[] }
  } catch (error: any) {
    console.error("[v0] Exception listing MCP clients:", error)
    return { success: false, error: error.message }
  }
}

/**
 * Create authorization code with PKCE
 */
export async function createAuthorizationCode(params: {
  client_id: string
  redirect_uri: string
  scope: string[]
  code_challenge: string
  code_challenge_method: "S256" | "plain"
}): Promise<{ success: boolean; code?: string; error?: string }> {
  try {
    const supabase = createClientSupabaseClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: "User not authenticated" }
    }

    const { data, error } = await supabase.rpc("create_authorization_code", {
      p_client_id: params.client_id,
      p_user_id: user.id,
      p_redirect_uri: params.redirect_uri,
      p_scope: params.scope,
      p_code_challenge: params.code_challenge,
      p_code_challenge_method: params.code_challenge_method,
    })

    if (error) {
      console.error("[v0] Error creating authorization code:", error)
      return { success: false, error: error.message }
    }

    return { success: true, code: data as string }
  } catch (error: any) {
    console.error("[v0] Exception creating authorization code:", error)
    return { success: false, error: error.message }
  }
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeAuthorizationCode(params: {
  code: string
  client_id: string
  redirect_uri: string
  code_verifier: string
}): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const supabase = createClientSupabaseClient()

    const { data, error } = await supabase.rpc("exchange_authorization_code", {
      p_code: params.code,
      p_client_id: params.client_id,
      p_redirect_uri: params.redirect_uri,
      p_code_verifier: params.code_verifier,
    })

    if (error) {
      console.error("[v0] Error exchanging authorization code:", error)
      return { success: false, error: error.message }
    }

    // Check for OAuth error response
    if (data && typeof data === "object" && "error" in data) {
      return {
        success: false,
        error: `${data.error}: ${data.error_description}`,
      }
    }

    return { success: true, data }
  } catch (error: any) {
    console.error("[v0] Exception exchanging authorization code:", error)
    return { success: false, error: error.message }
  }
}

/**
 * Revoke OAuth token
 */
export async function revokeMCPToken(
  token_hash: string,
  token_type: "access" | "refresh" = "access",
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClientSupabaseClient()

    const { data, error } = await supabase.rpc("revoke_oauth_token", {
      p_token_hash: token_hash,
      p_token_type: token_type,
    })

    if (error) {
      console.error("[v0] Error revoking token:", error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error: any) {
    console.error("[v0] Exception revoking token:", error)
    return { success: false, error: error.message }
  }
}

/**
 * Get MCP OAuth discovery endpoint URL
 * MCP clients use this for automatic OAuth configuration
 */
export function getMCPDiscoveryURL(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) {
    throw new Error("Invalid Supabase URL configuration")
  }
  // Works for both the default <ref>.supabase.co host and a custom domain such as api.kronova.io
  const { origin } = new URL(supabaseUrl)
  return `${origin}/.well-known/oauth-authorization-server/auth/v1`
}

/**
 * Get Supabase OAuth authorization endpoint
 */
export function getAuthorizationEndpoint(): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/oauth/authorize`
}

/**
 * Get Supabase OAuth token endpoint
 */
export function getTokenEndpoint(): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/oauth/token`
}

/**
 * Get JWKS endpoint for token validation
 */
export function getJWKSEndpoint(): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/.well-known/jwks.json`
}

/**
 * Build authorization URL for MCP client
 * This initiates the OAuth flow by redirecting to Supabase's authorization endpoint
 */
export function buildAuthorizationURL(params: {
  client_id: string
  redirect_uri: string
  scope: string[]
  state?: string
  code_challenge: string
  code_challenge_method: "S256"
}): string {
  const url = new URL(getAuthorizationEndpoint())
  url.searchParams.set("client_id", params.client_id)
  url.searchParams.set("redirect_uri", params.redirect_uri)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("scope", params.scope.join(" "))
  url.searchParams.set("code_challenge", params.code_challenge)
  url.searchParams.set("code_challenge_method", params.code_challenge_method)
  if (params.state) {
    url.searchParams.set("state", params.state)
  }
  return url.toString()
}

/**
 * Exchange authorization code for tokens
 * Called by the MCP client after user approves authorization
 */
export async function exchangeCodeForTokens(params: {
  code: string
  client_id: string
  client_secret?: string // Only for confidential clients
  redirect_uri: string
  code_verifier: string
}): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const response = await fetch(getTokenEndpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code: params.code,
        client_id: params.client_id,
        client_secret: params.client_secret,
        redirect_uri: params.redirect_uri,
        code_verifier: params.code_verifier,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        error: data.error_description || data.error || "Token exchange failed",
      }
    }

    return { success: true, data }
  } catch (error: any) {
    console.error("[v0] Exception exchanging code for tokens:", error)
    return { success: false, error: error.message }
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(params: {
  refresh_token: string
  client_id: string
  client_secret?: string
}): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const response = await fetch(getTokenEndpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: params.refresh_token,
        client_id: params.client_id,
        client_secret: params.client_secret,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        error: data.error_description || data.error || "Token refresh failed",
      }
    }

    return { success: true, data }
  } catch (error: any) {
    console.error("[v0] Exception refreshing token:", error)
    return { success: false, error: error.message }
  }
}
