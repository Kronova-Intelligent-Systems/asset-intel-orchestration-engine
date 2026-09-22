"use client"

import { useState, useTransition } from "react"
import { Plus, Trash2, KeyRound, Server, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import {
  listServiceAccounts,
  createServiceAccount,
  deleteServiceAccount,
  type ServiceAccount,
} from "@/app/actions/service-account-actions"
import { useRouter } from "next/navigation"

interface ServiceAccountManagerProps {
  initialAccounts: ServiceAccount[]
}

export function ServiceAccountManager({ initialAccounts }: ServiceAccountManagerProps) {
  const router = useRouter()
  const [accounts, setAccounts] = useState<ServiceAccount[]>(initialAccounts)
  const [createOpen, setCreateOpen]   = useState(false)
  const [name, setName]               = useState("")
  const [description, setDescription] = useState("")
  const [isPending, startTransition]  = useTransition()
  const [copiedId, setCopiedId]       = useState<string | null>(null)
  const [error, setError]             = useState<string | null>(null)

  const handleCreate = () => {
    if (!name.trim()) return
    setError(null)
    startTransition(async () => {
      const result = await createServiceAccount(name.trim(), description.trim() || undefined)
      if (result.error) {
        setError(result.error)
        return
      }
      if (result.data) setAccounts(prev => [result.data!, ...prev])
      setName("")
      setDescription("")
      setCreateOpen(false)
      router.refresh()
    })
  }

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const result = await deleteServiceAccount(id)
      if (!result.success) {
        setError(result.error ?? "Failed to delete")
        return
      }
      setAccounts(prev => prev.filter(a => a.id !== id))
      router.refresh()
    })
  }

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Service Accounts</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Machine identities that own API keys independently of human users.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="enterprise-button gap-2 border-0 shadow-sm">
              <Plus className="h-4 w-4" />
              New Service Account
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-morphism border-primary/20 sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="enterprise-text-gradient">Create Service Account</DialogTitle>
              <DialogDescription>
                Service accounts own API keys and are not tied to a human user.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="sa-name">Name</Label>
                <Input
                  id="sa-name"
                  placeholder="e.g. Production Ingest Bot"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="bg-background/60 border-border/40 focus:border-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sa-desc">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Textarea
                  id="sa-desc"
                  placeholder="What this service account is used for..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={2}
                  className="bg-background/60 border-border/40 focus:border-primary/40 resize-none"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={isPending}>Cancel</Button>
              <Button
                className="enterprise-button border-0"
                onClick={handleCreate}
                disabled={isPending || !name.trim()}
              >
                {isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Account list */}
      {accounts.length === 0 ? (
        <div className="enterprise-card rounded-xl p-12 flex flex-col items-center justify-center gap-3 text-center">
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/20 flex items-center justify-center">
            <Server className="h-5 w-5 text-primary" />
          </div>
          <p className="text-sm font-medium">No service accounts yet</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            Create a service account to issue API keys that are owned by a machine identity rather than a person.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map(account => (
            <div
              key={account.id}
              className={cn(
                "enterprise-card group relative overflow-hidden rounded-xl p-4",
                "flex items-start justify-between gap-4",
              )}
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="mt-0.5 h-9 w-9 rounded-lg bg-gradient-to-br from-primary/20 via-primary/10 to-accent/20 border border-primary/20 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                  <Server className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{account.name}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-primary/20 text-muted-foreground font-mono">
                      {account.slug}
                    </Badge>
                  </div>
                  {account.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{account.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <button
                      onClick={() => copyId(account.id)}
                      className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors font-mono"
                      title="Copy ID"
                    >
                      {copiedId === account.id
                        ? <Check className="h-3 w-3 text-emerald-400" />
                        : <Copy className="h-3 w-3" />
                      }
                      {account.id.slice(0, 8)}…
                    </button>
                    {account.created_at && (
                      <span className="text-[11px] text-muted-foreground">
                        Created {new Date(account.created_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs h-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                  asChild
                >
                  <a href={`/ai-suite/settings?tab=api-keys&sa=${account.id}`}>
                    <KeyRound className="h-3 w-3" />
                    Keys
                  </a>
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      disabled={isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="glass-morphism border-primary/20">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete service account?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This removes <strong>{account.name}</strong>. Any API keys scoped to this account should be revoked separately. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => handleDelete(account.id)}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
