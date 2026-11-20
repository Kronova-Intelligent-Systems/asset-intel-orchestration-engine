"use client"

import { useState } from "react"
import { Check, Copy } from 'lucide-react'

import { Button } from "@/components/ui/button"

export function ApiAuthExample() {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const authExample = `// Bearer Token Authentication
const headers = {
  'Authorization': 'Bearer YOUR_API_KEY',
  'Content-Type': 'application/json'
};

// API Key as Query Parameter (alternative)
fetch('https://app.kronova.io/api/v1/assets?api_key=YOUR_API_KEY')
  .then(response => response.json())
  .then(data => console.log(data));`

  return (
    <div className="border rounded-lg">
      <div className="p-4 border-b bg-muted/50">
        <h3 className="font-semibold text-lg">Authentication</h3>
        <p className="text-sm text-muted-foreground mt-1">Secure your API requests with authentication</p>
      </div>

      <div className="p-4">
        <p className="text-sm">
          The Kronova API uses API keys to authenticate requests. You can view and manage your API keys in the
          dashboard. Your API keys carry many privileges, so be sure to keep them secure!
        </p>

        <h4 className="font-medium mt-4">Authentication Methods</h4>
        <div className="mt-2 space-y-2">
          <div className="border rounded-lg p-3">
            <h5 className="font-medium">Bearer Token (Recommended)</h5>
            <p className="text-sm mt-1">Include your API key in the Authorization header of your requests.</p>
            <pre className="bg-black text-white p-2 rounded-md text-sm mt-2">Authorization: Bearer YOUR_API_KEY</pre>
          </div>

          <div className="border rounded-lg p-3">
            <h5 className="font-medium">Query Parameter</h5>
            <p className="text-sm mt-1">Include your API key as a query parameter in your requests.</p>
            <pre className="bg-black text-white p-2 rounded-md text-sm mt-2">
              https://app.kronova.io/api/v1/assets?api_key=YOUR_API_KEY
            </pre>
          </div>
        </div>

        <h4 className="font-medium mt-4">Example</h4>
        <div className="relative mt-2">
          <pre className="bg-black text-white p-4 rounded-md text-sm overflow-x-auto">{authExample}</pre>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2"
            onClick={() => copyToClipboard(authExample)}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-4">
          <h5 className="font-medium text-yellow-800">Security Best Practices</h5>
          <ul className="mt-1 space-y-1 list-disc list-inside text-sm text-yellow-700">
            <li>Never share your API keys in publicly accessible areas such as GitHub or client-side code.</li>
            <li>Use environment variables to store API keys in your applications.</li>
            <li>Implement proper key rotation and revocation procedures.</li>
            <li>Use scoped API keys with the minimum required permissions for your use case.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
