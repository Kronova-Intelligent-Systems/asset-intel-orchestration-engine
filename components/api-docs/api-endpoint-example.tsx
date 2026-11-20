"use client"

import { useState } from "react"
import { Check, Copy } from 'lucide-react'

import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function ApiEndpointExample() {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const curlExample = `curl -X GET "https://app.kronova.io/api/v1/assets" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json"`

  const responseExample = `{
  "success": true,
  "data": [
    {
      "id": "f8c3de3d-1fea-4d7c-a8b0-29f63c4c3454",
      "user_id": "e9a7d294-6a8b-4f5c-b85c-1d1e9d3f7a2b",
      "tracking_number": "RSND12345678",
      "status": "in_transit",
      "origin_address": {
        "name": "Warehouse A",
        "street": "123 Main St",
        "city": "San Francisco",
        "state": "CA",
        "zip": "94105",
        "country": "USA"
      },
      "destination_address": {
        "name": "Customer HQ",
        "street": "456 Market St",
        "city": "Los Angeles",
        "state": "CA",
        "zip": "90001",
        "country": "USA"
      },
      "shipping_date": "2023-09-15T10:30:00Z",
      "estimated_delivery": "2023-09-18T16:00:00Z",
      "carrier": "FastShip",
      "service_level": "Express",
      "package_ids": ["p-12345", "p-67890"],
      "created_at": "2023-09-14T08:15:22Z",
      "updated_at": "2023-09-15T11:20:45Z"
    }
  ]
}`

  return (
    <div className="border rounded-lg">
      <div className="p-4 border-b bg-muted/50">
        <h3 className="font-semibold text-lg">GET /shipping</h3>
        <p className="text-sm text-muted-foreground mt-1">Retrieve all shipping records for the authenticated user</p>
      </div>

      <div className="p-4">
        <h4 className="font-medium">Request Parameters</h4>
        <div className="mt-2 border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-2 text-left">Parameter</th>
                <th className="px-4 py-2 text-left">Type</th>
                <th className="px-4 py-2 text-left">Required</th>
                <th className="px-4 py-2 text-left">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="px-4 py-2">status</td>
                <td className="px-4 py-2">string</td>
                <td className="px-4 py-2">No</td>
                <td className="px-4 py-2">Filter by shipping status</td>
              </tr>
              <tr className="border-t">
                <td className="px-4 py-2">limit</td>
                <td className="px-4 py-2">integer</td>
                <td className="px-4 py-2">No</td>
                <td className="px-4 py-2">Maximum number of records to return (default: 20)</td>
              </tr>
              <tr className="border-t">
                <td className="px-4 py-2">offset</td>
                <td className="px-4 py-2">integer</td>
                <td className="px-4 py-2">No</td>
                <td className="px-4 py-2">Number of records to skip (default: 0)</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h4 className="font-medium mt-4">Example</h4>
        <Tabs defaultValue="curl" className="mt-2">
          <TabsList>
            <TabsTrigger value="curl">cURL</TabsTrigger>
            <TabsTrigger value="js">JavaScript</TabsTrigger>
            <TabsTrigger value="python">Python</TabsTrigger>
          </TabsList>
          <TabsContent value="curl" className="relative">
            <pre className="bg-black text-white p-4 rounded-md text-sm overflow-x-auto">{curlExample}</pre>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2"
              onClick={() => copyToClipboard(curlExample)}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </TabsContent>
          <TabsContent value="js" className="relative">
            <pre className="bg-black text-white p-4 rounded-md text-sm overflow-x-auto">
              {`import { KronovaClient } from '@kronova/sdk';

const client = new KronovaClient('YOUR_API_KEY');

async function getShippingRecords() {
  try {
    const response = await client.shipping.list();
    console.log(response.data);
  } catch (error) {
    console.error('Error fetching shipping records:', error);
  }
}`}
            </pre>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2"
              onClick={() =>
                copyToClipboard(`import { KronovaClient } from '@kronova/sdk';

const client = new KronovaClient('YOUR_API_KEY');

async function getShippingRecords() {
  try {
    const response = await client.shipping.list();
    console.log(response.data);
  } catch (error) {
    console.error('Error fetching shipping records:', error);
  }
}`)
              }
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </TabsContent>
          <TabsContent value="python" className="relative">
            <pre className="bg-black text-white p-4 rounded-md text-sm overflow-x-auto">
              {`from kronova import Client

client = Client('YOUR_API_KEY')

try:
    response = client.shipping.list()
    print(response.data)
except Exception as e:
    print(f"Error fetching shipping records: {e}")`}
            </pre>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2"
              onClick={() =>
                copyToClipboard(`from kronova import Client

client = Client('YOUR_API_KEY')

try:
    response = client.shipping.list()
    print(response.data)
except Exception as e:
    print(f"Error fetching shipping records: {e}")`)
              }
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </TabsContent>
        </Tabs>

        <h4 className="font-medium mt-4">Response</h4>
        <div className="relative mt-2">
          <pre className="bg-black text-white p-4 rounded-md text-sm overflow-x-auto">{responseExample}</pre>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2"
            onClick={() => copyToClipboard(responseExample)}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  )
}
