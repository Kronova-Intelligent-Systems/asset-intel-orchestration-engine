# OAuth 2.1 Server Configuration Guide

## Overview

Resend-It uses Supabase's native OAuth 2.1 server capabilities to provide secure authentication for third-party applications and MCP (Model Context Protocol) agents.

## Supabase OAuth 2.1 Endpoints

Your Supabase project exposes the following OAuth endpoints:

| Endpoint | URL |
|----------|-----|
| **Authorization** | `https://api.kronova.io/auth/v1/oauth/authorize` |
| **Token** | `https://api.kronova.io/auth/v1/oauth/token` |
| **JWKS** | `https://api.kronova.io/auth/v1/.well-known/jwks.json` |
| **Discovery** | `https://api.kronova.io/.well-known/oauth-authorization-server/auth/v1` |
| **OIDC Discovery** | `https://api.kronova.io/auth/v1/.well-known/openid-configuration` |

## Configuration Steps

### 1. Enable OAuth 2.1 Server in Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** > **OAuth Server**
3. Enable OAuth 2.1 server capabilities
4. Set **Authorization Path** to `/oauth/consent`

### 2. Configure JWT Signing Algorithm

For OAuth use cases, use **asymmetric JWT signing** (RS256 or ES256):

1. Go to **Authentication** > **Settings** > **JWT Settings**
2. Change algorithm from HS256 to **RS256** or **ES256**
3. This allows OAuth clients to validate JWTs using your public JWKS endpoint

**Note:** Asymmetric signing is **required** if you use OpenID Connect (request `openid` scope).

### 3. Set Site URL

1. Go to **Authentication** > **URL Configuration**
2. Set **Site URL** to your production domain: `https://app.resendit.com`
3. The authorization UI will be at: `https://app.resendit.com/oauth/consent`

### 4. Register OAuth Clients

Use the Resend-It UI at `/ai-suite/settings/oauth` to register OAuth clients, or use the Supabase dashboard:

1. Go to **Authentication** > **OAuth Apps**
2. Click **Add a new client**
3. Configure:
   - **Client Name**: Application name
   - **Redirect URIs**: Exact callback URLs (no wildcards)
   - **Client Type**: 
     - **Public** for mobile/SPA apps (no client secret)
     - **Confidential** for server-side apps (includes client secret)

## Authorization Flow

### For Third-Party Apps

1. **Initiate Authorization**
   ```
   GET https://api.kronova.io/auth/v1/oauth/authorize
   ?client_id=YOUR_CLIENT_ID
   &redirect_uri=YOUR_REDIRECT_URI
   &response_type=code
   &scope=openid email profile
   &code_challenge=CODE_CHALLENGE
   &code_challenge_method=S256
   &state=RANDOM_STATE
   ```

2. **User Redirected to Consent Page**
   - Supabase redirects to: `https://app.resendit.com/oauth/consent?authorization_id=<ID>`
   - User sees consent screen with requested permissions
   - User approves or denies

3. **Authorization Code Returned**
   - User redirected back to client's redirect_uri with authorization code
   - Client exchanges code for access token at token endpoint

4. **Access Token Exchange**
   ```
   POST https://api.kronova.io/auth/v1/oauth/token
   {
     "grant_type": "authorization_code",
     "client_id": "YOUR_CLIENT_ID",
     "client_secret": "YOUR_CLIENT_SECRET", // For confidential clients only
     "code": "AUTHORIZATION_CODE",
     "code_verifier": "CODE_VERIFIER",
     "redirect_uri": "YOUR_REDIRECT_URI"
   }
   ```

### For MCP Agents

MCP (Model Context Protocol) agents use the same OAuth 2.1 flow but with AI-specific considerations:

1. Register MCP agent as an OAuth client with appropriate scopes
2. Use PKCE for enhanced security
3. Request scopes like: `openid`, `execute_agents`, `read_assets`, `write_assets`

See `/docs/mcp-authentication.md` for detailed MCP setup.

## Available Scopes

| Scope | Description |
|-------|-------------|
| `openid` | OpenID Connect - basic user ID |
| `email` | User's email address |
| `profile` | Full user profile (name, avatar, etc.) |
| `read_assets` | Read access to user's assets |
| `write_assets` | Create, update, delete assets |
| `execute_agents` | Execute AI agents and workflows |
| `read_embeddings` | Access vector embeddings |
| `manage_tokenization` | Manage RWA tokenization |
| `manage_stablecoins` | Manage private stablecoins |

## Security Best Practices

1. **Use HTTPS**: All redirect URIs must use HTTPS in production
2. **Exact Redirect URIs**: Register complete, exact URLs (no wildcards)
3. **PKCE Required**: All authorization flows must use PKCE with S256
4. **Asymmetric Signing**: Use RS256/ES256 for JWT signing
5. **Separate Clients**: Create different OAuth clients per environment
6. **Rotate Secrets**: Regularly rotate client secrets for confidential clients
7. **Minimal Scopes**: Only request scopes your application needs

## Custom Access Tokens (Optional)

Use Custom Access Token Hooks to customize tokens:
- Set custom `audience` claim for third-party validation
- Add client-specific metadata
- Implement dynamic scopes

See Supabase docs: https://supabase.com/docs/guides/auth/auth-hooks/access-token-hook

## MCP (Model Context Protocol) Authentication

For AI agents and MCP clients, see the dedicated [MCP Authentication Guide](./MCP_AUTHENTICATION.md).

**Quick Start:**
1. Enable OAuth 2.1 in Supabase dashboard
2. Set authorization path to `/oauth/consent`
3. Switch JWT signing to RS256/ES256
4. MCP clients will auto-discover from: `https://api.kronova.io/.well-known/oauth-authorization-server/auth/v1`

## Troubleshooting

### Common Issues

1. **"Invalid redirect_uri"**
   - Ensure redirect URI is **exactly** registered in client configuration
   - Check for trailing slashes, protocol, port numbers

2. **"PKCE required"**
   - All OAuth 2.1 flows must include `code_challenge` and `code_challenge_method=S256`

3. **"Invalid authorization_id"**
   - Authorization IDs expire after 10 minutes
   - User must complete consent flow quickly

4. **ID token generation fails**
   - Switch from HS256 to RS256/ES256 in JWT settings
   - Required for OpenID Connect (`openid` scope)

## Resources

- [Supabase OAuth Server Docs](https://supabase.com/docs/guides/auth/oauth-server/getting-started)
- [MCP Authentication Guide](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication)
- [OAuth 2.1 Specification](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-07)
