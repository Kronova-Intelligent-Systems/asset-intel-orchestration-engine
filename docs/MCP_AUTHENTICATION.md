# MCP (Model Context Protocol) Authentication Guide

## Overview

Resend-It leverages Supabase's native OAuth 2.1 server to authenticate MCP (Model Context Protocol) agents. This allows AI tools like Claude Desktop, Cline, and other MCP clients to securely access your Resend-It data on behalf of authenticated users.

**Reference:** https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication

## Why Use Supabase Auth for MCP?

- **Existing user base** - AI agents authenticate as your existing Resend-It users
- **Standards-compliant OAuth 2.1** - Full PKCE implementation that MCP clients expect
- **Automatic discovery** - MCP clients auto-configure using Supabase's discovery endpoints
- **Dynamic registration** - MCP clients can self-register (optional)
- **Row Level Security** - Your existing RLS policies automatically protect MCP access
- **User authorization** - Users explicitly approve AI agent access
- **Token management** - Automatic refresh token rotation handled by Supabase

## OAuth Endpoints for MCP Clients

MCP clients will discover and use these Supabase endpoints:

| Endpoint | URL |
|----------|-----|
| **Discovery** | `https://api.kronova.io/.well-known/oauth-authorization-server/auth/v1` |
| **Authorization** | `https://api.kronova.io/auth/v1/oauth/authorize` |
| **Token** | `https://api.kronova.io/auth/v1/oauth/token` |
| **JWKS** | `https://api.kronova.io/auth/v1/.well-known/jwks.json` |

Your authorization UI is hosted at: `https://app.resendit.com/oauth/consent`

## Configuration Steps

### 1. Enable OAuth 2.1 Server in Supabase

1. Go to Supabase Dashboard > **Authentication** > **OAuth Server**
2. **Enable OAuth 2.1 server**
3. Set **Authorization Path** to `/oauth/consent`
4. (Optional) Enable **Dynamic Client Registration** for auto-registration

### 2. Configure JWT Signing for MCP

MCP requires asymmetric JWT signing for token validation:

1. Go to **Authentication** > **Settings** > **JWT Settings**
2. Change from **HS256** to **RS256** or **ES256**
3. This allows MCP clients to validate JWTs using your public JWKS endpoint

**Note:** This is required if you use the `openid` scope (recommended).

### 3. Register MCP Client (Manual Method)

If not using dynamic registration, manually register your MCP server:

1. Go to Resend-It UI at `/ai-suite/settings/oauth`
2. Click **Register New Client**
3. Configure:
   - **Client Name**: "My MCP Server" or AI tool name
   - **Client Type**: Public (for most MCP clients)
   - **Redirect URIs**: MCP client's callback URL (e.g., `http://localhost:3000/callback`)
   - **Allowed Scopes**: Select required scopes

Or use the API:
```typescript
import { registerMCPClient } from '@/lib/auth/mcp-oauth-client'

const result = await registerMCPClient({
  client_name: "My MCP Server",
  client_description: "AI agent for asset management",
  redirect_uris: ["http://localhost:3000/callback"],
  allowed_scopes: ["openid", "email", "read_assets", "execute_agents"]
})
```

### 4. Configure Your MCP Server

In your MCP server configuration, use:

```json
{
  "oauth": {
    "issuer": "https://api.kronova.io/auth/v1",
    "authorization_endpoint": "https://api.kronova.io/auth/v1/oauth/authorize",
    "token_endpoint": "https://api.kronova.io/auth/v1/oauth/token",
    "client_id": "YOUR_CLIENT_ID",
    "redirect_uri": "http://localhost:3000/callback",
    "scopes": ["openid", "email", "read_assets", "execute_agents"]
  }
}
```

Most MCP clients will auto-discover these endpoints from:
```
https://api.kronova.io/.well-known/oauth-authorization-server/auth/v1
```

## MCP Authentication Flow

1. **Discovery**: MCP client fetches OAuth configuration from discovery endpoint
2. **Authorization Request**: Client redirects user to Supabase's authorize endpoint with PKCE
3. **Consent Screen**: Supabase redirects to `/oauth/consent` where user sees requested permissions
4. **User Approval**: User approves or denies the MCP agent's access request
5. **Authorization Code**: Supabase redirects back to client with authorization code
6. **Token Exchange**: Client exchanges code + PKCE verifier for access/refresh tokens
7. **API Access**: MCP server makes authenticated requests to Resend-It APIs using access token

## Available Scopes for MCP

| Scope | Description |
|-------|-------------|
| `openid` | OpenID Connect - user ID (recommended) |
| `email` | User's email address |
| `profile` | Full user profile |
| `read_assets` | Read user's assets and asset intelligence |
| `write_assets` | Create, update, delete assets |
| `execute_agents` | Run AI agents and workflows |
| `read_embeddings` | Access vector embeddings |
| `manage_tokenization` | Tokenize real-world assets |
| `manage_stablecoins` | Create and manage private stablecoins |

## Security Best Practices

### For MCP Server Developers

1. **Use PKCE**: Always use code challenge with S256 method
2. **Validate Tokens**: Verify JWT signatures using JWKS endpoint
3. **Minimal Scopes**: Only request scopes your MCP server needs
4. **Secure Storage**: Store refresh tokens securely
5. **Handle Expiration**: Implement automatic token refresh

### For Resend-It Administrators

1. **Review Clients**: Regularly audit registered OAuth clients at `/ai-suite/settings/oauth`
2. **User Consent**: Always require explicit user approval for MCP clients
3. **RLS Policies**: Ensure Row Level Security policies protect sensitive data
4. **Monitor Access**: Track which MCP clients are accessing user data
5. **Revoke Access**: Users can revoke MCP client access at any time

## Testing Your MCP Integration

### 1. Test Discovery Endpoint

```bash
curl https://api.kronova.io/.well-known/oauth-authorization-server/auth/v1
```

Should return OAuth server metadata including endpoints and supported grant types.

### 2. Test Authorization Flow

Build an authorization URL:
```typescript
import { buildAuthorizationURL } from '@/lib/auth/mcp-oauth-client'

const authUrl = buildAuthorizationURL({
  client_id: "YOUR_CLIENT_ID",
  redirect_uri: "http://localhost:3000/callback",
  scope: ["openid", "email", "read_assets"],
  code_challenge: "CODE_CHALLENGE", // Generate from code_verifier
  code_challenge_method: "S256",
  state: "RANDOM_STATE"
})

// Redirect user to authUrl
```

### 3. Test Token Exchange

After receiving authorization code:
```typescript
import { exchangeCodeForTokens } from '@/lib/auth/mcp-oauth-client'

const result = await exchangeCodeForTokens({
  code: "AUTHORIZATION_CODE",
  client_id: "YOUR_CLIENT_ID",
  redirect_uri: "http://localhost:3000/callback",
  code_verifier: "CODE_VERIFIER"
})

// result.data contains access_token, refresh_token, expires_in
```

## Troubleshooting

### MCP client can't discover OAuth configuration

**Problem:** Client shows "OAuth discovery failed"

**Solutions:**
- Verify OAuth 2.1 is enabled in Supabase dashboard
- Check that discovery endpoint returns valid JSON
- Ensure project URL is accessible from MCP client

### Dynamic registration fails

**Problem:** 403/404 on registration endpoint

**Solutions:**
- Enable dynamic client registration in Supabase dashboard
- Verify redirect URIs are complete URLs with protocol and port
- Check rate limiting

### Token exchange fails with "invalid_grant"

**Problem:** Authorization code exchange returns error

**Solutions:**
- Ensure code hasn't expired (10 minute limit)
- Verify code_verifier matches code_challenge
- Check redirect_uri exactly matches registration
- Confirm client_id is correct

### MCP client can't access data despite valid token

**Problem:** API calls return 403 Forbidden

**Solutions:**
- Verify RLS policies allow access for the user/client
- Check that required scopes were granted
- Ensure access token hasn't expired
- Test with service role key to isolate RLS issues

## Example: Claude Desktop MCP Integration

Configure Claude Desktop to use Resend-It as an MCP server:

```json
{
  "mcpServers": {
    "resendit": {
      "command": "node",
      "args": ["/path/to/resendit-mcp-server/dist/index.js"],
      "env": {
        "OAUTH_CLIENT_ID": "YOUR_CLIENT_ID",
        "OAUTH_ISSUER": "https://api.kronova.io/auth/v1",
        "REDIRECT_URI": "http://localhost:3000/callback"
      }
    }
  }
}
```

When Claude Desktop starts, it will:
1. Discover OAuth configuration from Supabase
2. Open browser for user to authorize
3. User approves on `/oauth/consent` page
4. Claude receives tokens and can access Resend-It APIs

## Resources

- [Supabase MCP Authentication Docs](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication)
- [MCP Specification](https://modelcontextprotocol.io/docs)
- [OAuth 2.1 Draft](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-07)
- [FastMCP Framework](https://gofastmcp.com) - Simplified MCP server development with Supabase integration
