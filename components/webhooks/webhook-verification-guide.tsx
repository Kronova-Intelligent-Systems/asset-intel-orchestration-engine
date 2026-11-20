"use client"

import { useState } from "react"
import { BookOpen, Check, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const NODE_SNIPPET = `import crypto from "node:crypto"

const TOLERANCE_SECONDS = 300

export function verifyWebhook({ secret, timestamp, rawBody, signature }) {
  const age = Math.abs(Date.now() / 1000 - Number(timestamp))
  if (!Number.isFinite(age) || age > TOLERANCE_SECONDS) return false

  const expected =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(timestamp + "." + rawBody).digest("hex")

  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

// Next.js route handler
export async function POST(req) {
  const rawBody = await req.text() // verify the raw bytes, not re-serialized JSON
  const valid = verifyWebhook({
    secret: process.env.KRONOVA_WEBHOOK_SECRET,
    timestamp: req.headers.get("x-webhook-timestamp") ?? "",
    signature: req.headers.get("x-webhook-signature") ?? "",
    rawBody,
  })
  if (!valid) return new Response("Invalid signature", { status: 401 })

  const event = JSON.parse(rawBody)
  // Deduplicate on event.id: retries reuse the same delivery id.
  return new Response("ok")
}`

const PYTHON_SNIPPET = `import hashlib
import hmac
import time

TOLERANCE_SECONDS = 300


def verify_webhook(secret: str, timestamp: str, raw_body: bytes, signature: str) -> bool:
    try:
        age = abs(time.time() - int(timestamp))
    except ValueError:
        return False
    if age > TOLERANCE_SECONDS:
        return False

    digest = hmac.new(
        secret.encode(), timestamp.encode() + b"." + raw_body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest("sha256=" + digest, signature)


# FastAPI
# @app.post("/webhooks/kronova")
# async def receive(request: Request):
#     raw_body = await request.body()
#     if not verify_webhook(
#         SECRET,
#         request.headers.get("x-webhook-timestamp", ""),
#         raw_body,
#         request.headers.get("x-webhook-signature", ""),
#     ):
#         raise HTTPException(status_code=401)
#     return {"ok": True}`

const CURL_SNIPPET = `# Reproduce a signature locally to debug a mismatch
TIMESTAMP=1731628800
BODY='{"id":"...","event":"webhook.test","data":{},"timestamp":"..."}'
printf '%s.%s' "$TIMESTAMP" "$BODY" \\
  | openssl dgst -sha256 -hmac "$KRONOVA_WEBHOOK_SECRET" -hex`

const HEADERS = [
  ["X-Webhook-Id", "Unique delivery ID. Retries of the same delivery reuse it, so use it to deduplicate."],
  ["X-Webhook-Event", "Event name, for example asset.created."],
  ["X-Webhook-Timestamp", "Unix timestamp in seconds, covered by the signature."],
  ["X-Webhook-Signature", "sha256=<hex> HMAC-SHA256 of timestamp + \".\" + raw request body."],
]

function CodeBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="icon"
        className="absolute right-2 top-2 h-8 w-8"
        onClick={copy}
        aria-label={`Copy ${label} snippet`}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
      <pre className="max-h-[50vh] overflow-auto rounded-lg border bg-muted p-4 pr-12 text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  )
}

export function WebhookVerificationGuide() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <BookOpen className="mr-2 h-4 w-4" />
          Verification guide
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Verify webhook signatures</DialogTitle>
          <DialogDescription>
            Every delivery is signed with your webhook secret. Reject any request that fails verification before
            processing it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <caption className="sr-only">Headers sent with every webhook delivery</caption>
              <tbody>
                {HEADERS.map(([name, description]) => (
                  <tr key={name} className="border-b last:border-b-0">
                    <th scope="row" className="whitespace-nowrap px-3 py-2 text-left font-mono text-xs font-medium">
                      {name}
                    </th>
                    <td className="px-3 py-2 text-muted-foreground">{description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Compute the HMAC over the raw request body. Re-serialized JSON will not match.</li>
            <li>Compare with a constant-time function and reject timestamps older than 5 minutes.</li>
            <li>Respond with a 2xx within 5 seconds. 408, 425, 429 and 5xx responses are retried with backoff.</li>
            <li>Endpoints must use HTTPS and cannot point at private or internal addresses.</li>
            <li>After 10 consecutive failed deliveries a webhook is disabled automatically.</li>
          </ul>

          <Tabs defaultValue="node">
            <TabsList>
              <TabsTrigger value="node">Node.js</TabsTrigger>
              <TabsTrigger value="python">Python</TabsTrigger>
              <TabsTrigger value="shell">Debug (shell)</TabsTrigger>
            </TabsList>
            <TabsContent value="node">
              <CodeBlock code={NODE_SNIPPET} label="Node.js" />
            </TabsContent>
            <TabsContent value="python">
              <CodeBlock code={PYTHON_SNIPPET} label="Python" />
            </TabsContent>
            <TabsContent value="shell">
              <CodeBlock code={CURL_SNIPPET} label="shell" />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}
