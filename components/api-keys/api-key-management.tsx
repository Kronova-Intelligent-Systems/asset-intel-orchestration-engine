"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Copy, Trash2, Key, Activity, Shield, RotateCw, CheckCircle2, Server } from "lucide-react"
import { toast } from "sonner"
import { useSearchParams } from "next/navigation"
import {
  createAPIKey,
  getAPIKeys,
  revokeAPIKey,
  deleteAPIKey,
  rotateAPIKey,
  updateAPIKeyScopes,
  type APIKey,
} from "@/app/actions/api-keys"
import { listServiceAccounts, type ServiceAccount } from "@/app/actions/service-account-actions"
import { AVAILABLE_SCOPES } from "@/lib/schemas"

// Ownership of a key by a service account is stored as a `service_account:<id>`
// scope tag. Helpers to read/strip that tag for display.
const SA_SCOPE_PREFIX = "service_account:"
const getServiceAccountId = (scopes?: string[]) =>
  scopes?.find((s) => s.startsWith(SA_SCOPE_PREFIX))?.slice(SA_SCOPE_PREFIX.length) ?? null
const visibleScopes = (scopes?: string[]) => (scopes || []).filter((s) => !s.startsWith(SA_SCOPE_PREFIX))

export function APIKeyManagement() {
  const searchParams = useSearchParams()
  const [apiKeys, setApiKeys] = useState<APIKey[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newKeyName, setNewKeyName] = useState("")
  const [expiresIn, setExpiresIn] = useState<string>("never")
  const [selectedScopes, setSelectedScopes] = useState<string[]>(["execute:agents", "execute:workflows"])
  const [serviceAccounts, setServiceAccounts] = useState<ServiceAccount[]>([])
  const [selectedServiceAccount, setSelectedServiceAccount] = useState<string>("none")
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [showCreatedKey, setShowCreatedKey] = useState(false)
  const [selectedKeyStats, setSelectedKeyStats] = useState<any>(null)
  const [statsDialogOpen, setStatsDialogOpen] = useState(false)
  const [editingScopesFor, setEditingScopesFor] = useState<string | null>(null)
  const [editingScopes, setEditingScopes] = useState<string[]>([])
  const [scopesDialogOpen, setScopesDialogOpen] = useState(false)

  useEffect(() => {
    loadAPIKeys()
    loadServiceAccounts()
  }, [])

  // Deep link from the Service Accounts page: /ai-suite/settings?tab=api-keys&sa=<id>
  // opens the create dialog with that service account preselected.
  useEffect(() => {
    const sa = searchParams.get("sa")
    if (sa) {
      setSelectedServiceAccount(sa)
      setCreateDialogOpen(true)
    }
  }, [searchParams])

  async function loadServiceAccounts() {
    const result = await listServiceAccounts()
    if (!result.error) {
      setServiceAccounts(result.data || [])
    }
  }

  async function loadAPIKeys() {
    setLoading(true)
    const result = await getAPIKeys()
    if (result.error) {
      toast.error(result.error)
    } else {
      setApiKeys(result.data || [])
    }
    setLoading(false)
  }

  async function handleCreateKey() {
    if (!newKeyName.trim()) {
      toast.error("Please enter a name for the API key")
      return
    }

    if (selectedScopes.length === 0) {
      toast.error("Please select at least one scope for the API key")
      return
    }

    const expiresInDays = expiresIn === "never" ? undefined : Number.parseInt(expiresIn)
    const serviceAccountId = selectedServiceAccount === "none" ? undefined : selectedServiceAccount
    const result = await createAPIKey(newKeyName, expiresInDays, selectedScopes, serviceAccountId)

    if (result.error) {
      toast.error(result.error)
    } else {
      setCreatedKey(result.data?.key || null)
      setShowCreatedKey(true)
      setNewKeyName("")
      setExpiresIn("never")
      setSelectedScopes(["execute:agents", "execute:workflows"])
      setSelectedServiceAccount("none")
      loadAPIKeys()
      toast.success("API key created successfully with selected scopes")
    }
  }

  async function handleRevokeKey(keyId: string) {
    const result = await revokeAPIKey(keyId)
    if (result.error) {
      toast.error(result.error)
    } else {
      loadAPIKeys()
      toast.success("API key revoked successfully")
    }
  }

  async function handleDeleteKey(keyId: string) {
    const result = await deleteAPIKey(keyId)
    if (result.error) {
      toast.error(result.error)
    } else {
      loadAPIKeys()
      toast.success("API key deleted successfully")
    }
  }

  async function handleRotateKey(keyId: string) {
    const result = await rotateAPIKey(keyId)
    if (result.error) {
      toast.error(result.error)
    } else {
      setCreatedKey(result.data?.key || null)
      setShowCreatedKey(true)
      setCreateDialogOpen(true)
      loadAPIKeys()
      toast.success("API key rotated successfully")
    }
  }

  async function handleViewStats(keyId: string) {
    const result = await getAPIKeys() // Placeholder for actual stats retrieval logic
    if (result.error) {
      toast.error(result.error)
    } else {
      setSelectedKeyStats(result.data)
      setStatsDialogOpen(true)
    }
  }

  async function handleEditScopes(keyId: string, currentScopes: string[]) {
    setEditingScopesFor(keyId)
    setEditingScopes(currentScopes || [])
    setScopesDialogOpen(true)
  }

  async function handleSaveScopes() {
    if (!editingScopesFor) return

    if (editingScopes.length === 0) {
      toast.error("At least one scope must be selected")
      return
    }

    const result = await updateAPIKeyScopes(editingScopesFor, editingScopes)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("API key scopes updated successfully")
      loadAPIKeys()
      setScopesDialogOpen(false)
      setEditingScopesFor(null)
      setEditingScopes([])
    }
  }

  function toggleScope(scope: string, isCreating = false) {
    if (isCreating) {
      setSelectedScopes((prev) => (prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]))
    } else {
      setEditingScopes((prev) => (prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]))
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    toast.success("API key copied to clipboard")
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              API Keys
            </CardTitle>
            <CardDescription>
              Manage your API keys for programmatic access with enterprise-grade security and granular scope control
            </CardDescription>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>Create New Key</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Create API Key</DialogTitle>
                <DialogDescription>
                  Generate a new API key for accessing the Kronova Platform API programmatically with granular permissions.
                </DialogDescription>
              </DialogHeader>
              {!createdKey ? (
                <>
                  <div className="space-y-6 py-4 pr-2 max-h-[60vh] overflow-y-auto">
                    <div className="space-y-2">
                      <Label htmlFor="key-name">Key Name</Label>
                      <Input
                        id="key-name"
                        placeholder="e.g., Production API Key"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="expires-in">Expiration</Label>
                      <Select value={expiresIn} onValueChange={setExpiresIn}>
                        <SelectTrigger id="expires-in">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="never">Never</SelectItem>
                          <SelectItem value="30">30 days</SelectItem>
                          <SelectItem value="60">60 days</SelectItem>
                          <SelectItem value="90">90 days</SelectItem>
                          <SelectItem value="365">1 year</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="service-account" className="flex items-center gap-2">
                        <Server className="h-4 w-4" />
                        Service Account <span className="text-muted-foreground font-normal">(optional)</span>
                      </Label>
                      <Select value={selectedServiceAccount} onValueChange={setSelectedServiceAccount}>
                        <SelectTrigger id="service-account">
                          <SelectValue placeholder="No service account (owned by you)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No service account (owned by you)</SelectItem>
                          {serviceAccounts.map((sa) => (
                            <SelectItem key={sa.id} value={sa.id}>
                              {sa.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground">
                        Attach this key to a machine identity instead of your personal account. Manage accounts under{" "}
                        <span className="font-medium">Service Accounts</span>.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        <Label>Permissions (Scopes)</Label>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Select the permissions this API key will have. Choose carefully based on your use case.
                      </p>
                      <div className="space-y-4">
                        {AVAILABLE_SCOPES.map((scope) => (
                          <div key={scope.value} className="flex items-start space-x-3 py-2">
                            <Checkbox
                              id={`scope-${scope.value}`}
                              checked={selectedScopes.includes(scope.value)}
                              onCheckedChange={() => toggleScope(scope.value, true)}
                              className="mt-1"
                            />
                            <div className="flex-1 space-y-1 min-w-0">
                              <label
                                htmlFor={`scope-${scope.value}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer block"
                              >
                                {scope.label}
                              </label>
                              <p className="text-sm text-muted-foreground leading-relaxed">{scope.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      {selectedScopes.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-2">
                          <span className="text-sm text-muted-foreground">Selected:</span>
                          {selectedScopes.map((scope) => (
                            <Badge key={scope} variant="secondary" className="text-xs">
                              {scope}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => setCreateDialogOpen(false)} className="w-full sm:w-auto">
                      Cancel
                    </Button>
                    <Button onClick={handleCreateKey} className="w-full sm:w-auto">
                      Create Key
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <div className="space-y-4 py-4">
                    <div className="rounded-lg bg-amber-50 p-4 border border-amber-200">
                      <div className="flex gap-2 mb-2">
                        <CheckCircle2 className="h-5 w-5 text-amber-600 flex-shrink-0" />
                        <div className="text-sm text-amber-800">
                          <p className="font-semibold mb-1">Save this key now!</p>
                          <p>This is the only time you'll see the full key. Store it securely.</p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Your API Key</Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            readOnly
                            type={showCreatedKey ? "text" : "password"}
                            value={createdKey}
                            className="font-mono text-sm pr-10"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                            onClick={() => setShowCreatedKey(!showCreatedKey)}
                          >
                            {showCreatedKey ? <CheckCircle2 className="h-4 w-4" /> : <Key className="h-4 w-4" />}
                          </Button>
                        </div>
                        <Button variant="outline" size="icon" onClick={() => copyToClipboard(createdKey)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => {
                        setCreatedKey(null)
                        setShowCreatedKey(false)
                        setCreateDialogOpen(false)
                      }}
                    >
                      Done
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading API keys...</div>
        ) : apiKeys.length === 0 ? (
          <div className="text-center py-8">
            <Key className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No API keys yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first API key to start using the API with secure authentication and granular permissions
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {apiKeys.map((key) => (
              <div
                key={key.id}
                className="flex flex-col gap-4 p-4 border rounded-lg hover:border-primary/50 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h4 className="font-medium truncate">{key.name}</h4>
                      {key.is_active ? (
                        <Badge variant="default" className="bg-green-500">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Revoked</Badge>
                      )}
                      {key.expires_at && new Date(key.expires_at) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) && (
                        <Badge variant="destructive" className="text-xs">
                          Expiring Soon
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground font-mono">{key.key_prefix}...</p>
                    {(() => {
                      const saId = getServiceAccountId(key.scopes)
                      if (!saId) return null
                      const sa = serviceAccounts.find((s) => s.id === saId)
                      return (
                        <Badge variant="outline" className="mt-2 gap-1 border-primary/30 text-xs font-normal">
                          <Server className="h-3 w-3 text-primary" />
                          {sa ? sa.name : "Service account"}
                        </Badge>
                      )
                    })()}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                      <span>Created: {formatDate(key.created_at)}</span>
                      {key.expires_at && <span>Expires: {formatDate(key.expires_at)}</span>}
                      {key.last_used_at && <span>Last used: {formatDate(key.last_used_at)}</span>}
                      {(key as any).total_requests > 0 && <span>Requests: {(key as any).total_requests}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => handleViewStats(key.id)}>
                      <Activity className="h-4 w-4 mr-1" />
                      <span className="hidden sm:inline">Stats</span>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleEditScopes(key.id, key.scopes || [])}>
                      <Shield className="h-4 w-4 mr-1" />
                      <span className="hidden sm:inline">Scopes</span>
                    </Button>
                    {key.is_active && (
                      <Button variant="outline" size="sm" onClick={() => handleRotateKey(key.id)}>
                        <RotateCw className="h-4 w-4 mr-1" />
                        <span className="hidden sm:inline">Rotate</span>
                      </Button>
                    )}
                    {key.is_active && (
                      <Button variant="outline" size="sm" onClick={() => handleRevokeKey(key.id)}>
                        Revoke
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => handleDeleteKey(key.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {visibleScopes(key.scopes).length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      Scopes:
                    </span>
                    {visibleScopes(key.scopes).map((scope) => (
                      <Badge key={scope} variant="outline" className="text-xs">
                        {scope}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* ... existing stats dialog ... */}

      <Dialog open={scopesDialogOpen} onOpenChange={setScopesDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit API Key Scopes</DialogTitle>
            <DialogDescription>
              Modify the permissions for this API key. Changes take effect immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 pr-2 max-h-[60vh] overflow-y-auto">
            {AVAILABLE_SCOPES.map((scope) => (
              <div key={scope.value} className="flex items-start space-x-3 py-2">
                <Checkbox
                  id={`edit-scope-${scope.value}`}
                  checked={editingScopes.includes(scope.value)}
                  onCheckedChange={() => toggleScope(scope.value, false)}
                  className="mt-1"
                />
                <div className="flex-1 space-y-1 min-w-0">
                  <label
                    htmlFor={`edit-scope-${scope.value}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer block"
                  >
                    {scope.label}
                  </label>
                  <p className="text-sm text-muted-foreground leading-relaxed">{scope.description}</p>
                </div>
              </div>
            ))}
          </div>
          {editingScopes.length > 0 && (
            <div className="flex flex-wrap gap-2 py-2 border-t">
              <span className="text-sm text-muted-foreground">Selected:</span>
              {editingScopes.map((scope) => (
                <Badge key={scope} variant="secondary" className="text-xs">
                  {scope}
                </Badge>
              ))}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setScopesDialogOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleSaveScopes} className="w-full sm:w-auto">
              Save Scopes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
