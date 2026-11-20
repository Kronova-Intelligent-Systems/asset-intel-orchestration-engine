"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Copy, Eye, EyeOff, Plus, Trash2, AlertCircle, BookOpen, Server, Download, X } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { AVAILABLE_SCOPES } from "@/lib/schemas"
import { createOAuthClient, deleteOAuthClient, rotateOAuthClientSecret } from "@/app/actions/oauth-client-actions"
import { useRouter } from "next/navigation"

interface OAuthClient {
  id: string
  client_id: string
  client_secret: string
  client_name: string
  client_description: string | null
  redirect_uris: string[]
  allowed_scopes: string[]
  created_at: string
}

interface OAuthSettingsClientProps {
  oauthClients: OAuthClient[]
  userId: string
}

export function OAuthSettingsClient({ oauthClients, userId }: OAuthSettingsClientProps) {
  const [clients, setClients] = useState<OAuthClient[]>(oauthClients)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({})
  const [isCreating, setIsCreating] = useState(false)
  const [newClient, setNewClient] = useState({
    name: "",
    description: "",
    redirectUris: [""],
    scopes: [] as string[],
  })
  const { toast } = useToast()
  const router = useRouter()

  const loadClients = async () => {
    router.refresh()
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    })
  }

  const toggleShowSecret = (clientId: string) => {
    setShowSecret((prev) => ({ ...prev, [clientId]: !prev[clientId] }))
  }

  const downloadDocs = () => {
    window.open("/docs#oauth", "_blank")
  }

  const handleCreateClient = async () => {
    if (!newClient.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Client name is required",
        variant: "destructive",
      })
      return
    }

    const validRedirectUris = newClient.redirectUris.filter((uri) => uri.trim() !== "")
    if (validRedirectUris.length === 0) {
      toast({
        title: "Validation Error",
        description: "At least one redirect URI is required",
        variant: "destructive",
      })
      return
    }

    if (newClient.scopes.length === 0) {
      toast({
        title: "Validation Error",
        description: "At least one scope must be selected",
        variant: "destructive",
      })
      return
    }

    setIsCreating(true)

    const result = await createOAuthClient({
      clientName: newClient.name,
      clientDescription: newClient.description || undefined,
      redirectUris: validRedirectUris,
      allowedScopes: newClient.scopes,
    })

    setIsCreating(false)

    if (result.error) {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      })
      return
    }

    toast({
      title: "Success",
      description: "OAuth client created successfully",
    })

    setShowCreateDialog(false)
    setNewClient({
      name: "",
      description: "",
      redirectUris: [""],
      scopes: [],
    })

    await loadClients()
  }

  const handleDeleteClient = async (clientId: string) => {
    if (!confirm("Are you sure you want to delete this OAuth client? This action cannot be undone.")) {
      return
    }

    const result = await deleteOAuthClient(clientId)

    if (result.error) {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      })
      return
    }

    toast({
      title: "Success",
      description: "OAuth client deleted successfully",
    })

    setClients(clients.filter((c) => c.id !== clientId))
  }

  const handleRotateSecret = async (clientId: string) => {
    if (!confirm("Are you sure you want to rotate this client secret? The old secret will stop working.")) {
      return
    }

    const result = await rotateOAuthClientSecret(clientId)

    if (result.error) {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      })
      return
    }

    toast({
      title: "Success",
      description: "Client secret rotated successfully",
    })

    await loadClients()
  }

  const addRedirectUri = () => {
    setNewClient({ ...newClient, redirectUris: [...newClient.redirectUris, ""] })
  }

  const removeRedirectUri = (index: number) => {
    const updated = newClient.redirectUris.filter((_, i) => i !== index)
    setNewClient({ ...newClient, redirectUris: updated.length === 0 ? [""] : updated })
  }

  const updateRedirectUri = (index: number, value: string) => {
    const updated = [...newClient.redirectUris]
    updated[index] = value
    setNewClient({ ...newClient, redirectUris: updated })
  }

  const toggleScope = (scopeValue: string) => {
    const updated = newClient.scopes.includes(scopeValue)
      ? newClient.scopes.filter((s) => s !== scopeValue)
      : [...newClient.scopes, scopeValue]
    setNewClient({ ...newClient, scopes: updated })
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold">OAuth 2.1 Integration</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={downloadDocs}>
              <Download className="h-4 w-4 mr-2" />
              Documentation
            </Button>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New OAuth Client
            </Button>
          </div>
        </div>
        <p className="text-muted-foreground">Manage OAuth 2.1 clients and integrate our API with your applications</p>
      </div>

      {/* Create OAuth Client Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create OAuth Client</DialogTitle>
            <DialogDescription>Create a new OAuth 2.1 client to integrate with the Kronova Platform API</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Client Name */}
            <div className="space-y-2">
              <Label htmlFor="client-name">
                Client Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="client-name"
                placeholder="My Application"
                value={newClient.name}
                onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
              />
            </div>

            {/* Client Description */}
            <div className="space-y-2">
              <Label htmlFor="client-description">Description</Label>
              <Textarea
                id="client-description"
                placeholder="Optional description of your application"
                value={newClient.description}
                onChange={(e) => setNewClient({ ...newClient, description: e.target.value })}
                rows={3}
              />
            </div>

            {/* Redirect URIs */}
            <div className="space-y-2">
              <Label>
                Redirect URIs <span className="text-destructive">*</span>
              </Label>
              <p className="text-xs text-muted-foreground mb-2">
                Add the callback URLs where users will be redirected after authorization
              </p>
              {newClient.redirectUris.map((uri, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder="https://example.com/oauth/callback"
                    value={uri}
                    onChange={(e) => updateRedirectUri(index, e.target.value)}
                  />
                  {newClient.redirectUris.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeRedirectUri(index)}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addRedirectUri}>
                <Plus className="h-4 w-4 mr-2" />
                Add URI
              </Button>
            </div>

            {/* Scopes */}
            <div className="space-y-2">
              <Label>
                Allowed Scopes <span className="text-destructive">*</span>
              </Label>
              <p className="text-xs text-muted-foreground mb-3">
                Select the permissions this client will be allowed to request
              </p>
              <div className="border rounded-lg p-4 space-y-3 max-h-[300px] overflow-y-auto">
                {AVAILABLE_SCOPES.map((scope) => (
                  <div key={scope.value} className="flex items-start space-x-3">
                    <Checkbox
                      id={`scope-${scope.value}`}
                      checked={newClient.scopes.includes(scope.value)}
                      onCheckedChange={() => toggleScope(scope.value)}
                    />
                    <div className="flex-1">
                      <Label htmlFor={`scope-${scope.value}`} className="text-sm font-medium cursor-pointer">
                        {scope.label}
                      </Label>
                      <p className="text-xs text-muted-foreground">{scope.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Your client credentials will be displayed once. Make sure to save them securely.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={isCreating}>
              Cancel
            </Button>
            <Button onClick={handleCreateClient} disabled={isCreating}>
              {isCreating ? "Creating..." : "Create Client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="clients" className="space-y-6">
        <TabsList>
          <TabsTrigger value="clients" className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            OAuth Clients
          </TabsTrigger>
          <TabsTrigger value="documentation" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Quick Start
          </TabsTrigger>
        </TabsList>

        {/* OAuth Clients Tab */}
        <TabsContent value="clients" className="space-y-6">
          {clients.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Server className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No OAuth Clients</h3>
                <p className="text-sm text-muted-foreground mb-4">Create your first OAuth client to get started</p>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create OAuth Client
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6">
              {clients.map((client) => (
                <Card key={client.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{client.client_name}</CardTitle>
                        {client.client_description && (
                          <CardDescription className="mt-1">{client.client_description}</CardDescription>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteClient(client.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Client ID */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Client ID</Label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 px-3 py-2 bg-muted rounded-md text-sm font-mono">
                          {client.client_id}
                        </code>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => copyToClipboard(client.client_id, "Client ID")}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Client Secret */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Client Secret</Label>
                        <Button variant="outline" size="sm" onClick={() => handleRotateSecret(client.id)}>
                          Rotate Secret
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 px-3 py-2 bg-muted rounded-md text-sm font-mono">
                          {showSecret[client.id] ? client.client_secret : "••••••••••••••••"}
                        </code>
                        <Button variant="outline" size="icon" onClick={() => toggleShowSecret(client.id)}>
                          {showSecret[client.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => copyToClipboard(client.client_secret, "Client Secret")}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          Keep your client secret secure. Don't share it in public repositories or client-side code.
                        </AlertDescription>
                      </Alert>
                    </div>

                    {/* Redirect URIs */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Redirect URIs</Label>
                      <div className="space-y-1">
                        {client.redirect_uris.map((uri, index) => (
                          <div key={index} className="px-3 py-2 bg-muted rounded-md text-sm">
                            {uri}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Scopes */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Allowed Scopes</Label>
                      <div className="flex flex-wrap gap-2">
                        {client.allowed_scopes.map((scope) => (
                          <Badge key={scope} variant="secondary">
                            {scope}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Created At */}
                    <div className="text-xs text-muted-foreground">
                      Created {new Date(client.created_at).toLocaleDateString()}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Documentation Tab */}
        <TabsContent value="documentation" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>OAuth 2.1 Integration Quick Start</CardTitle>
              <CardDescription>Get started with integrating our API using OAuth 2.1 authentication</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <BookOpen className="h-4 w-4" />
                <AlertDescription>
                  For complete documentation including Express.js and Next.js code examples, download the integration
                  guide.
                  <Button variant="link" className="h-auto p-0 ml-2" onClick={downloadDocs}>
                    View Full Documentation
                  </Button>
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">1. Create an OAuth Client</h4>
                  <p className="text-sm text-muted-foreground">
                    Create an OAuth client from the "OAuth Clients" tab. You'll receive a Client ID and Client Secret.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">2. Authorization Flow</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Our API uses OAuth 2.1 with PKCE. Redirect users to:
                  </p>
                  <code className="block bg-muted p-3 rounded text-xs overflow-x-auto">
                    {`https://app.kronova.io/oauth/authorize?
  response_type=code
  &client_id=YOUR_CLIENT_ID
  &redirect_uri=YOUR_REDIRECT_URI
  &scope=execute_agents read_assets
  &code_challenge=CODE_CHALLENGE
  &code_challenge_method=S256`}
                  </code>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">3. Exchange Code for Tokens</h4>
                  <code className="block bg-muted p-3 rounded text-xs overflow-x-auto">
                    {`POST https://app.kronova.io/oauth/token
{
  "grant_type": "authorization_code",
  "client_id": "YOUR_CLIENT_ID",
  "client_secret": "YOUR_CLIENT_SECRET",
  "code": "AUTHORIZATION_CODE",
  "code_verifier": "CODE_VERIFIER"
}`}
                  </code>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">4. Make API Requests</h4>
                  <code className="block bg-muted p-3 rounded text-xs overflow-x-auto">
                    {`GET https://app.kronova.io/api/v1/agents
Authorization: Bearer YOUR_ACCESS_TOKEN`}
                  </code>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Available Scopes</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {AVAILABLE_SCOPES.slice(0, 6).map((scope) => (
                      <div key={scope.value} className="border rounded-lg p-3">
                        <Badge variant="secondary" className="mb-1">
                          {scope.value}
                        </Badge>
                        <p className="text-xs text-muted-foreground">{scope.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <Button onClick={downloadDocs} className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Download Full Integration Guide
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Includes complete Express.js and Next.js examples, webhook setup, and best practices
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
