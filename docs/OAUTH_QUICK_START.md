# OAuth 2.1 Quick Start Guide

This guide helps you quickly set up OAuth 2.1 authentication for Resend-It.

## Choose Your Approach

Resend-It supports two OAuth 2.1 implementations:

### Option 1: Supabase Native (Recommended for Most Users)
✅ Quick 5-minute setup
✅ Managed security and updates
✅ Perfect for MCP clients

### Option 2: Custom OAuth Server
✅ Full control over authorization logic
✅ Custom business rules
✅ White-label capabilities

---

## Quick Setup: Supabase Native OAuth 2.1

### Step 1: Enable in Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **OAuth Server**
3. Click **Enable OAuth 2.1 Server**
4. Set **Authorization Path** to: `/oauth/consent`
5. Click **Save**

### Step 2: Set Environment Variable

Add to your `.env.local`:
```bash
NEXT_PUBLIC_AUTH_PROVIDER=supabase
```

### Step 3: Register an OAuth Client

Visit: `https://your-domain.com/ai-suite/settings/oauth`

Or use the API:
```typescript
import { registerMCPClient } from '@/lib/auth/mcp-oauth-client'

const client = await registerMCPClient({
  client_name: "My Application",
  client_type: "public",
  redirect_uris: ["http://localhost:3000/callback"],
  allowed_scopes: ["read_assets", "execute_agents"]
})

console.log("Client ID:", client.data.client_id)
```

### Step 4: Test the Flow

Open in browser:
```
https://api.kronova.io/auth/v1/oauth/authorize
  ?client_id=YOUR_CLIENT_ID
  &redirect_uri=http://localhost:3000/callback
  &response_type=code
  &scope=read_assets
  &code_challenge=YOUR_PKCE_CHALLENGE
  &code_challenge_method=S256
```

✅ Done! Your OAuth 2.1 server is live.

---

## Quick Setup: Custom OAuth 2.1

### Step 1: Set Environment Variable

Add to your `.env.local`:
```bash
NEXT_PUBLIC_AUTH_PROVIDER=custom
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

### Step 2: Ensure Database Tables Exist

Run migrations if not already done:
```bash
# OAuth tables should already exist from previous migrations
# Verify tables: oauth_clients, oauth_authorization_codes, oauth_access_tokens
```

### Step 3: Register an OAuth Client

```typescript
import { registerOAuthClient } from '@/lib/auth/oauth-server'

const client = await registerOAuthClient({
  client_name: "My Application",
  client_type: "public",
  redirect_uris: ["http://localhost:3000/callback"],
  allowed_scopes: ["read_assets", "execute_agents"]
})

console.log("Client ID:", client.data.client_id)
```

### Step 4: Test the Flow

Open in browser:
```
https://your-domain.com/api/v1/oauth/authorize
  ?client_id=YOUR_CLIENT_ID
  &redirect_uri=http://localhost:3000/callback
  &response_type=code
  &scope=read_assets
  &code_challenge=YOUR_PKCE_CHALLENGE
  &code_challenge_method=S256
```

✅ Done! Your custom OAuth server is live.

---

## MCP Configuration

### For Supabase Native OAuth

**cline_mcp_settings.json:**
```json
{
  "mcpServers": {
    "resendit": {
      "command": "mcp",
      "args": ["run", "resendit"],
      "oauth": {
        "discovery_url": "https://api.kronova.io/.well-known/oauth-authorization-server/auth/v1",
        "client_id": "YOUR_CLIENT_ID",
        "redirect_uri": "http://localhost:3000/callback",
        "scopes": ["read_assets", "execute_agents"]
      }
    }
  }
}
```

### For Custom OAuth

**cline_mcp_settings.json:**
```json
{
  "mcpServers": {
    "resendit": {
      "command": "mcp",
      "args": ["run", "resendit"],
      "oauth": {
        "discovery_url": "https://your-domain.com/.well-known/oauth-authorization-server",
        "client_id": "YOUR_CLIENT_ID",
        "redirect_uri": "http://localhost:3000/callback",
        "scopes": ["read_assets", "execute_agents"]
      }
    }
  }
}
```

---

## Available Scopes

| Scope | Description |
|-------|-------------|
| `openid` | Basic user ID and authentication |
| `email` | User email address |
| `profile` | Full user profile information |
| `read_assets` | View assets and asset intelligence |
| `write_assets` | Create and update assets |
| `execute_agents` | Run AI agents and workflows |
| `read_embeddings` | Access vector embeddings |
| `manage_tokenization` | Create and manage tokenized assets |
| `manage_stablecoins` | Create and manage private stablecoins |

---

## Switching Between Modes

To switch from Supabase Native to Custom:
```bash
# Change environment variable
NEXT_PUBLIC_AUTH_PROVIDER=custom

# Restart your app
npm run dev
```

To switch from Custom to Supabase Native:
```bash
# Change environment variable
NEXT_PUBLIC_AUTH_PROVIDER=supabase

# Enable OAuth in Supabase dashboard
# Restart your app
npm run dev
```

---

## Need Help?

- 📖 Full documentation: `docs/OAUTH_ARCHITECTURE.md`
- 🔧 Troubleshooting: `docs/OAUTH_CONFIGURATION.md`
- 🤖 MCP Authentication: `docs/MCP_AUTHENTICATION.md`
