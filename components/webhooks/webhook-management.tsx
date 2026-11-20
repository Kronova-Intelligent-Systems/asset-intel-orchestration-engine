"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import {
  createWebhook,
  getWebhooks,
  updateWebhook,
  deleteWebhook,
  getWebhookLogs,
  testWebhook,
} from "@/app/actions/webhook-actions"
import { WEBHOOK_EVENTS } from "@/lib/webhooks/events"
import { WebhookVerificationGuide } from "@/components/webhooks/webhook-verification-guide"
import {
  Plus,
  Trash2,
  Copy,
  Check,
  Zap,
  AlertCircle,
  CheckCircle,
  Clock,
  ExternalLink,
  History,
  Send,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"

const AVAILABLE_EVENTS = WEBHOOK_EVENTS

interface Webhook {
  id: string
  user_id: string
  name: string
  url: string
  description: string | null
  events: string[]
  secret?: string
  is_active: boolean
  last_status: string | null
  last_triggered_at: string | null
  failure_count: number
  created_at: string
  updated_at: string
}

export function WebhookManagement() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newSecret, setNewSecret] = useState<string | null>(null)
  const [copiedSecret, setCopiedSecret] = useState(false)
  const [viewingLogs, setViewingLogs] = useState<string | null>(null)
  const [webhookLogs, setWebhookLogs] = useState<any[]>([])
  const [testingId, setTestingId] = useState<string | null>(null)
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    name: "",
    url: "",
    description: "",
    events: [] as string[],
  })

  useEffect(() => {
    loadWebhooks()
  }, [])

  async function loadWebhooks() {
    setLoading(true)
    const result = await getWebhooks()
    if (result.success && result.data) {
      setWebhooks(result.data)
    } else if (result.error) {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      })
    }
    setLoading(false)
  }

  async function handleCreateWebhook() {
    if (!formData.name || !formData.url || formData.events.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields and select at least one event",
        variant: "destructive",
      })
      return
    }

    const result = await createWebhook(formData)
    if (result.success && result.data) {
      toast({
        title: "Success",
        description: "Webhook created successfully",
      })
      setNewSecret(result.data.secret)
      setFormData({ name: "", url: "", description: "", events: [] })
      loadWebhooks()
    } else if (result.error) {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      })
    }
  }

  async function handleUpdateWebhook(id: string, data: Pick<Webhook, "is_active">) {
    const result = await updateWebhook(id, data)
    if (result.success) {
      toast({
        title: "Success",
        description: "Webhook updated successfully",
      })
      loadWebhooks()
    } else if (result.error) {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      })
    }
  }

  async function handleDeleteWebhook(id: string) {
    if (!confirm("Are you sure you want to delete this webhook?")) return

    const result = await deleteWebhook(id)
    if (result.success) {
      toast({
        title: "Success",
        description: "Webhook deleted successfully",
      })
      loadWebhooks()
    } else if (result.error) {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      })
    }
  }

  async function handleTestWebhook(id: string) {
    setTestingId(id)
    const result = await testWebhook(id)
    setTestingId(null)

    toast({
      title: result.success ? "Test event delivered" : "Test event failed",
      description: result.message ?? result.error,
      variant: result.success ? "default" : "destructive",
    })
    loadWebhooks()
  }

  async function handleViewLogs(webhookId: string) {
    const result = await getWebhookLogs(webhookId)
    if (result.success && result.data) {
      setWebhookLogs(result.data)
      setViewingLogs(webhookId)
    } else if (result.error) {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      })
    }
  }

  function copySecret(secret: string) {
    navigator.clipboard.writeText(secret)
    setCopiedSecret(true)
    setTimeout(() => setCopiedSecret(false), 2000)
    toast({
      title: "Copied",
      description: "Secret copied to clipboard",
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Webhooks</CardTitle>
              <CardDescription>
                Configure webhooks to receive real-time notifications about events in your account
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
            <WebhookVerificationGuide />
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Webhook
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Webhook</DialogTitle>
                  <DialogDescription>Configure a webhook endpoint to receive event notifications</DialogDescription>
                </DialogHeader>

                {newSecret ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                      <div className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-semibold text-green-900 dark:text-green-100">
                            Webhook Created Successfully
                          </h4>
                          <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                            Save this secret securely. You won't be able to see it again.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Webhook Secret</Label>
                      <div className="flex gap-2">
                        <Input value={newSecret} readOnly className="font-mono text-sm" />
                        <Button variant="outline" size="icon" onClick={() => copySecret(newSecret)}>
                          {copiedSecret ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Use this secret to verify webhook signatures in your application
                      </p>
                    </div>

                    <DialogFooter>
                      <Button
                        onClick={() => {
                          setNewSecret(null)
                          setCreateDialogOpen(false)
                        }}
                      >
                        Done
                      </Button>
                    </DialogFooter>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name *</Label>
                      <Input
                        id="name"
                        placeholder="My Webhook"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="url">Endpoint URL *</Label>
                      <Input
                        id="url"
                        type="url"
                        placeholder="https://example.com/webhooks"
                        value={formData.url}
                        onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        placeholder="Optional description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Events to Subscribe *</Label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 border rounded-lg">
                        {AVAILABLE_EVENTS.map((event) => (
                          <div key={event.value} className="flex items-center space-x-2">
                            <Checkbox
                              id={event.value}
                              checked={formData.events.includes(event.value)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setFormData({
                                    ...formData,
                                    events: [...formData.events, event.value],
                                  })
                                } else {
                                  setFormData({
                                    ...formData,
                                    events: formData.events.filter((e) => e !== event.value),
                                  })
                                }
                              }}
                            />
                            <label
                              htmlFor={event.value}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              {event.label}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <DialogFooter>
                      <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreateWebhook}>Create Webhook</Button>
                    </DialogFooter>
                  </div>
                )}
              </DialogContent>
            </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading webhooks...</div>
          ) : webhooks.length === 0 ? (
            <div className="text-center py-8">
              <Zap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No webhooks configured</h3>
              <p className="text-muted-foreground mb-4">
                Create your first webhook to start receiving event notifications
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {webhooks.map((webhook) => (
                <Card key={webhook.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold truncate">{webhook.name}</h4>
                          <Badge variant={webhook.is_active ? "default" : "secondary"}>
                            {webhook.is_active ? "Active" : "Inactive"}
                          </Badge>
                          {webhook.last_status && (
                            <Badge variant={webhook.last_status === "success" ? "default" : "destructive"}>
                              {webhook.last_status === "success" ? (
                                <CheckCircle className="h-3 w-3 mr-1" />
                              ) : (
                                <AlertCircle className="h-3 w-3 mr-1" />
                              )}
                              {webhook.last_status}
                            </Badge>
                          )}
                          {webhook.failure_count > 0 && (
                            <Badge variant="destructive">{webhook.failure_count} failures</Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                          <ExternalLink className="h-3 w-3" />
                          <span className="truncate">{webhook.url}</span>
                        </div>

                        {webhook.description && (
                          <p className="text-sm text-muted-foreground mb-2">{webhook.description}</p>
                        )}

                        <div className="flex flex-wrap gap-1 mb-2">
                          {webhook.events.map((event) => (
                            <Badge key={event} variant="outline" className="text-xs">
                              {event}
                            </Badge>
                          ))}
                        </div>

                        {webhook.last_triggered_at && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            Last triggered{" "}
                            {formatDistanceToNow(new Date(webhook.last_triggered_at), {
                              addSuffix: true,
                            })}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Switch
                          checked={webhook.is_active}
                          onCheckedChange={(checked) => handleUpdateWebhook(webhook.id, { is_active: checked })}
                          aria-label={`${webhook.is_active ? "Disable" : "Enable"} ${webhook.name}`}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTestWebhook(webhook.id)}
                          disabled={testingId === webhook.id}
                          aria-label={`Send test event to ${webhook.name}`}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewLogs(webhook.id)}
                          aria-label={`View delivery logs for ${webhook.name}`}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteWebhook(webhook.id)}
                          aria-label={`Delete ${webhook.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={viewingLogs !== null} onOpenChange={() => setViewingLogs(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Webhook Delivery Logs</DialogTitle>
            <DialogDescription>Recent webhook delivery attempts and their status</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {webhookLogs.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No delivery logs yet</p>
            ) : (
              webhookLogs.map((log) => {
                const succeeded = log.response_status >= 200 && log.response_status < 300 && !log.error_message
                return (
                  <Card key={log.id}>
                    <CardContent className="pt-4">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <Badge variant={succeeded ? "default" : "destructive"}>
                            {succeeded ? (
                              <CheckCircle className="h-3 w-3 mr-1" />
                            ) : (
                              <AlertCircle className="h-3 w-3 mr-1" />
                            )}
                            {succeeded ? "success" : "failed"}
                          </Badge>
                          <span className="text-sm font-mono">{log.event_type}</span>
                          {log.response_status && (
                            <span className="text-xs text-muted-foreground">HTTP {log.response_status}</span>
                          )}
                        </div>
                        {log.error_message && <p className="text-sm text-destructive mb-2">{log.error_message}</p>}
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(log.delivered_at), { addSuffix: true })}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
