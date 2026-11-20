import { Badge } from "@/components/ui/badge"

const BASE_URLS = [
  { surface: "REST API", url: "https://app.kronova.io/api/v1", note: "Next.js route handlers" },
  { surface: "Agent2Agent (A2A)", url: "https://app.kronova.io/api/a2a", note: "A2A protocol endpoint" },
  { surface: "Edge Functions", url: "https://api.kronova.io/functions/v1/<name>", note: "Supabase Edge Functions" },
  { surface: "Auth, OAuth 2.1 / MCP", url: "https://api.kronova.io/auth/v1", note: "Supabase Auth" },
  { surface: "Local development", url: "http://localhost:3000/api/v1", note: "When you self-host" },
]

const STATUS_CODES = [
  { code: "200", meaning: "Request succeeded." },
  { code: "400", meaning: "The body or query parameters failed validation." },
  { code: "401", meaning: "The Authorization header is missing, malformed, or the key is invalid or expired." },
  { code: "403", meaning: "The key is valid but is missing a required scope. The message names the scope." },
  { code: "404", meaning: "The resource does not exist or does not belong to you." },
  { code: "500", meaning: "Unexpected server error." },
]

const SUCCESS_EXAMPLE = `{
  "success": true,
  "data": {
    "assets": [ /* ... */ ],
    "pagination": { "total": 128, "limit": 50, "offset": 0, "hasMore": true }
  },
  "timestamp": "2026-11-19T12:00:00.000Z"
}`

const ERROR_EXAMPLE = `{
  "success": false,
  "error": "API key missing required scope(s): write:assets",
  "timestamp": "2026-11-19T12:00:00.000Z"
}`

const REQUEST_EXAMPLE = `curl "https://app.kronova.io/api/v1/assets?limit=10&type=equipment" \\
  -H "Authorization: Bearer $KRONOVA_API_KEY"`

function CodeBlock({ label, children }: { label: string; children: string }) {
  return (
    <div className="enterprise-card overflow-hidden">
      <div className="px-4 py-2 border-b border-border/40 bg-muted/30">
        <span className="text-xs text-muted-foreground font-mono">{label}</span>
      </div>
      <pre className="bg-card/80 text-foreground p-4 text-xs sm:text-sm font-mono overflow-x-auto leading-relaxed">
        {children}
      </pre>
    </div>
  )
}

export function ApiConventions() {
  return (
    <section aria-labelledby="conventions-heading" className="space-y-6">
      <div>
        <h3 id="conventions-heading" className="text-xl font-bold mb-1">
          <span className="enterprise-text-gradient">Conventions</span>
        </h3>
        <p className="text-sm text-muted-foreground">
          Everything below applies to every endpoint in the reference. The machine-readable contract is the OpenAPI 3.0
          specification, available from the download button above.
        </p>
      </div>

      <div className="enterprise-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border/40 bg-muted/20">
          <h4 className="font-semibold text-sm text-foreground">Base URLs</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Kronova base URLs by surface</caption>
            <thead>
              <tr className="border-b border-border/30 bg-muted/10">
                <th scope="col" className="px-5 py-2.5 text-left text-xs font-medium text-muted-foreground">Surface</th>
                <th scope="col" className="px-5 py-2.5 text-left text-xs font-medium text-muted-foreground">URL</th>
                <th scope="col" className="px-5 py-2.5 text-left text-xs font-medium text-muted-foreground">Notes</th>
              </tr>
            </thead>
            <tbody>
              {BASE_URLS.map((row) => (
                <tr key={row.surface} className="border-b border-border/20 last:border-0">
                  <td className="px-5 py-3 text-foreground">{row.surface}</td>
                  <td className="px-5 py-3">
                    <code className="text-xs font-mono text-foreground/80">{row.url}</code>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground text-xs">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-5 py-3 text-xs text-muted-foreground border-t border-border/30">
          <code className="font-mono">api.kronova.io</code> only serves the Supabase gateway paths (
          <code className="font-mono">/auth/v1</code>, <code className="font-mono">/rest/v1</code>,{" "}
          <code className="font-mono">/storage/v1</code>, <code className="font-mono">/functions/v1</code>). The REST API
          lives on <code className="font-mono">app.kronova.io</code>.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="space-y-3">
          <h4 className="font-semibold text-sm text-foreground">Authenticated request</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Send your API key as a Bearer token. Keys start with <code className="font-mono text-foreground">sk_live_</code>{" "}
            and are only shown once when you create them; Kronova stores a SHA-256 hash, not the key.
          </p>
          <CodeBlock label="request.sh">{REQUEST_EXAMPLE}</CodeBlock>
        </div>

        <div className="space-y-3">
          <h4 className="font-semibold text-sm text-foreground">Pagination</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            List endpoints accept <code className="font-mono text-foreground">limit</code> (default 50, maximum 100) and{" "}
            <code className="font-mono text-foreground">offset</code>. Responses include a{" "}
            <code className="font-mono text-foreground">pagination</code> object with{" "}
            <code className="font-mono text-foreground">total</code>, <code className="font-mono text-foreground">limit</code>,{" "}
            <code className="font-mono text-foreground">offset</code> and{" "}
            <code className="font-mono text-foreground">hasMore</code>. Results are scoped to the owner of the key, so you
            only ever see your own data.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="space-y-3">
          <h4 className="font-semibold text-sm text-foreground">Success envelope</h4>
          <CodeBlock label="200 OK">{SUCCESS_EXAMPLE}</CodeBlock>
        </div>
        <div className="space-y-3">
          <h4 className="font-semibold text-sm text-foreground">Error envelope</h4>
          <CodeBlock label="403 Forbidden">{ERROR_EXAMPLE}</CodeBlock>
        </div>
      </div>

      <div className="enterprise-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border/40 bg-muted/20">
          <h4 className="font-semibold text-sm text-foreground">Status codes</h4>
        </div>
        <ul className="divide-y divide-border/20">
          {STATUS_CODES.map(({ code, meaning }) => (
            <li key={code} className="flex items-start gap-4 px-5 py-3">
              <Badge variant="outline" className="font-mono text-xs w-12 justify-center shrink-0">
                {code}
              </Badge>
              <span className="text-sm text-muted-foreground">{meaning}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
