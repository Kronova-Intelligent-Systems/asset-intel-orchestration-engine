# Resend-It OAuth 2.1 Architecture Guide

## Overview

Resend-It provides **two OAuth 2.1 implementations** to give you flexibility based on your use case:

### 1. Custom OAuth 2.1 Server (Self-Managed)
**Path:** `/api/v1/oauth/authorize`
- Full control over authorization logic
- Custom business rules and validation
- Direct database operations
- Manual token generation and management

### 2. Supabase Native OAuth 2.1 Server (Managed)
**Path:** `/oauth/consent` (via Supabase's `/auth/v1/oauth/authorize`)
- Leverages Supabase's built-in OAuth functionality
- Automatic PKCE validation
- Managed token lifecycle
- Built-in security features

---

## When to Use Each Approach

### Use Custom OAuth 2.1 When:

✅ You need **custom authorization logic** (e.g., multi-tenant approval workflows)
✅ You require **fine-grained control** over token generation
✅ You want to **integrate with external systems** during authorization
✅ You need **custom claims** in access tokens
✅ You're building **white-label** OAuth for multiple organizations
✅ You need **audit logging** for compliance requirements

**Example Use Cases:**
- Enterprise SSO with custom identity providers
- Multi-level approval workflows (e.g., manager approval required)
- Integration with external fraud detection systems
- Custom rate limiting per client
- Specialized token formats for legacy systems

### Use Supabase Native OAuth 2.1 When:

✅ You want **quick setup** with minimal code
✅ You trust **Supabase's security** and token management
✅ You need **automatic token rotation** and refresh
✅ You want **built-in PKCE validation**
✅ You prefer **managed infrastructure** over custom logic
✅ You're integrating with **MCP clients** that expect standard OAuth

**Example Use Cases:**
- Standard OAuth for third-party integrations
- MCP (Model Context Protocol) authentication
- Developer API access tokens
- Mobile app authentication
- Standard SaaS integrations

---

## Architecture Comparison

### Custom OAuth 2.1 Flow

```
┌─────────────┐
│ MCP Client  │
└──────┬──────┘
       │ 1. GET /api/v1/oauth/authorize
       ↓
┌──────────────────────────────┐
│ Custom Authorization Server  │
│  /api/v1/oauth/authorize     │
│                              │
│  • Validate client_id        │
│  • Check redirect_uri        │
│  • Verify PKCE               │
│  • Custom business logic     │
│  • Generate auth code        │
└──────┬───────────────────────┘
       │ 2. Redirect with code
       ↓
┌─────────────┐
│ MCP Client  │
└──────┬──────┘
       │ 3. POST /api/v1/oauth/token
       ↓
┌──────────────────────────────┐
│ Custom Token Endpoint        │
│  /api/v1/oauth/token         │
│                              │
│  • Validate code             │
│  • Verify PKCE challenge     │
│  • Generate access token     │
│  • Custom claims             │
└──────┬───────────────────────┘
       │ 4. Return tokens
       ↓
┌─────────────┐
│ MCP Client  │
└─────────────┘
```

### Supabase Native OAuth 2.1 Flow

```
┌─────────────┐
│ MCP Client  │
└──────┬──────┘
       │ 1. GET /auth/v1/oauth/authorize
       ↓
┌──────────────────────────────┐
│ Supabase OAuth Server        │
│  (Built-in to Supabase)      │
│                              │
│  • Validate client           │
│  • Check user session        │
│  • Redirect to consent UI    │
└──────┬───────────────────────┘
       │ 2. Redirect to /oauth/consent
       ↓
┌──────────────────────────────┐
│ Your Consent Page            │
│  /oauth/consent              │
│                              │
│  • Display permissions       │
│  • User approves/denies      │
│  • supabase.auth.oauth       │
│    .approveAuthorization()   │
└──────┬───────────────────────┘
       │ 3. Redirect with code
       ↓
┌─────────────┐
│ MCP Client  │
└──────┬──────┘
       │ 4. POST /auth/v1/oauth/token
       ↓
┌──────────────────────────────┐
│ Supabase Token Endpoint      │
│  (Built-in to Supabase)      │
│                              │
│  • Validate code             │
│  • Verify PKCE               │
│  • Generate tokens           │
└──────┬───────────────────────┘
       │ 5. Return tokens
       ↓
┌─────────────┐
│ MCP Client  │
└─────────────┘
```

---

## Configuration

### Custom OAuth 2.1 Configuration

**1. Database Setup**
Ensure these tables exist:
- `oauth_clients` - Registered OAuth clients
- `oauth_authorization_codes` - Authorization codes
- `oauth_access_tokens` - Access tokens
- `oauth_refresh_tokens` - Refresh tokens

**2. Client Registration**
```typescript
import { registerOAuthClient } from '@/lib/auth/oauth-server'

const client = await registerOAuthClient({
  client_name: "My MCP Client",
  client_type: "public",
  redirect_uris: ["http://localhost:3000/callback"],
  allowed_scopes: ["read_assets", "execute_agents"]
})
```

**3. Authorization URL**
```
https://your-domain.com/api/v1/oauth/authorize
  ?client_id=YOUR_CLIENT_ID
  &redirect_uri=http://localhost:3000/callback
  &response_type=code
  &scope=read_assets execute_agents
  &code_challenge=PKCE_CHALLENGE
  &code_challenge_method=S256
  &state=RANDOM_STATE
```

### Supabase Native OAuth 2.1 Configuration

**1. Enable in Supabase Dashboard**
- Go to Authentication → OAuth Server
- Enable OAuth 2.1 Server
- Set Authorization Path to `/oauth/consent`

**2. Client Registration (via Supabase Dashboard or API)**
```typescript
import { registerMCPClient } from '@/lib/auth/mcp-oauth-client'

const client = await registerMCPClient({
  client_name: "My MCP Client",
  client_type: "public",
  redirect_uris: ["http://localhost:3000/callback"],
  allowed_scopes: ["read_assets", "execute_agents"]
})
```

**3. Authorization URL**
```
https://api.kronova.io/auth/v1/oauth/authorize
  ?client_id=YOUR_CLIENT_ID
  &redirect_uri=http://localhost:3000/callback
  &response_type=code
  &scope=read_assets execute_agents
  &code_challenge=PKCE_CHALLENGE
  &code_challenge_method=S256
  &state=RANDOM_STATE
```

---

## Endpoints Reference

### Custom OAuth 2.1 Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/oauth/authorize` | GET | Authorization endpoint |
| `/api/v1/oauth/token` | POST | Token endpoint |
| `/api/v1/oauth/revoke` | POST | Token revocation |
| `/api/v1/oauth/clients` | GET/POST | Client management |
| `/.well-known/oauth-authorization-server` | GET | Discovery endpoint |

### Supabase Native OAuth 2.1 Endpoints

| Endpoint | Description |
|----------|-------------|
| `https://api.kronova.io/auth/v1/oauth/authorize` | Authorization endpoint |
| `https://api.kronova.io/auth/v1/oauth/token` | Token endpoint |
| `https://api.kronova.io/auth/v1/.well-known/jwks.json` | JWKS endpoint |
| `https://api.kronova.io/.well-known/oauth-authorization-server/auth/v1` | Discovery endpoint |
| `https://api.kronova.io/auth/v1/.well-known/openid-configuration` | OIDC discovery |

---

## MCP (Model Context Protocol) Configuration

### Using Custom OAuth 2.1 with MCP

**mcp_config.json:**
```json
{
  "servers": {
    "resendit": {
      "command": "mcp-client",
      "args": ["--oauth"],
      "env": {
        "OAUTH_DISCOVERY_URL": "https://your-domain.com/.well-known/oauth-authorization-server",
        "OAUTH_CLIENT_ID": "your_client_id",
        "OAUTH_REDIRECT_URI": "http://localhost:3000/callback",
        "OAUTH_SCOPES": "read_assets execute_agents"
      }
    }
  }
}
```

### Using Supabase Native OAuth 2.1 with MCP

**mcp_config.json:**
```json
{
  "servers": {
    "resendit": {
      "command": "mcp-client",
      "args": ["--oauth"],
      "env": {
        "OAUTH_DISCOVERY_URL": "https://api.kronova.io/.well-known/oauth-authorization-server/auth/v1",
        "OAUTH_CLIENT_ID": "your_client_id",
        "OAUTH_REDIRECT_URI": "http://localhost:3000/callback",
        "OAUTH_SCOPES": "read_assets execute_agents"
      }
    }
  }
}
```

---

## Security Considerations

### Custom OAuth 2.1

**Pros:**
- Full audit trail in your database
- Custom security policies
- Fine-grained access control
- Integration with external security systems

**Cons:**
- You're responsible for security updates
- Must implement token rotation manually
- Requires ongoing maintenance

**Best Practices:**
- Always use PKCE (required for OAuth 2.1)
- Implement rate limiting
- Log all authorization attempts
- Rotate secrets regularly
- Use short-lived access tokens (15 min)

### Supabase Native OAuth 2.1

**Pros:**
- Automatic security updates
- Built-in token rotation
- PKCE enforced by default
- Managed JWKS rotation

**Cons:**
- Less control over token claims
- Dependent on Supabase's security model
- Limited customization

**Best Practices:**
- Use asymmetric JWT signing (RS256)
- Monitor token usage via Supabase dashboard
- Set appropriate token expiration times
- Enable audit logging in Supabase

---

## Migration Path

### From Custom to Supabase Native

1. Enable Supabase OAuth in dashboard
2. Migrate client registrations to Supabase
3. Update MCP config to use Supabase endpoints
4. Test authorization flow
5. Deprecate custom endpoints

### From Supabase Native to Custom

1. Implement custom authorization endpoint
2. Migrate token generation logic
3. Update client configurations
4. Test custom flow
5. Disable Supabase OAuth

---

## Testing

### Testing Custom OAuth 2.1

```bash
# 1. Register a test client
curl -X POST https://your-domain.com/api/v1/oauth/clients \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "Test Client",
    "client_type": "public",
    "redirect_uris": ["http://localhost:3000/callback"],
    "allowed_scopes": ["read_assets"]
  }'

# 2. Get authorization code
# Open in browser:
https://your-domain.com/api/v1/oauth/authorize?client_id=CLIENT_ID&redirect_uri=http://localhost:3000/callback&response_type=code&scope=read_assets&code_challenge=CHALLENGE&code_challenge_method=S256

# 3. Exchange code for token
curl -X POST https://your-domain.com/api/v1/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "authorization_code",
    "code": "AUTH_CODE",
    "client_id": "CLIENT_ID",
    "redirect_uri": "http://localhost:3000/callback",
    "code_verifier": "VERIFIER"
  }'
```

### Testing Supabase Native OAuth 2.1

```bash
# 1. Register client via Supabase Dashboard or API

# 2. Get authorization code
# Open in browser:
https://api.kronova.io/auth/v1/oauth/authorize?client_id=CLIENT_ID&redirect_uri=http://localhost:3000/callback&response_type=code&scope=read_assets&code_challenge=CHALLENGE&code_challenge_method=S256

# 3. Exchange code for token
curl -X POST https://api.kronova.io/auth/v1/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "authorization_code",
    "code": "AUTH_CODE",
    "client_id": "CLIENT_ID",
    "redirect_uri": "http://localhost:3000/callback",
    "code_verifier": "VERIFIER"
  }'
```

---

## Troubleshooting

### Custom OAuth 2.1 Issues

**Problem:** "Invalid client_id"
- Verify client exists in `oauth_clients` table
- Check `is_active` is `true`

**Problem:** "Invalid redirect_uri"
- Ensure redirect URI matches exactly
- Check `redirect_uris` array in client record

**Problem:** "PKCE validation failed"
- Verify code_challenge_method is "S256"
- Ensure code_verifier matches challenge

### Supabase Native OAuth 2.1 Issues

**Problem:** "Authorization path not found"
- Set Authorization Path to `/oauth/consent` in Supabase dashboard

**Problem:** "Consent page not loading"
- Check that `/oauth/consent/page.tsx` exists
- Verify Supabase session is valid

**Problem:** "Token exchange failed"
- Ensure client_id is correct
- Verify code hasn't expired (5 min lifetime)
- Check PKCE code_verifier

---

## Recommendation

For most use cases, we recommend **Supabase Native OAuth 2.1** because:
- It's faster to set up
- It's more secure (managed by Supabase)
- It's automatically maintained and updated
- It integrates seamlessly with MCP clients

Use **Custom OAuth 2.1** only when you need specific business logic or custom token claims that Supabase doesn't support.
