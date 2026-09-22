"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { APIKeyManagement } from "@/components/api-keys/api-key-management"
import { WebhookManagement } from "@/components/webhooks/webhook-management"
import { NotificationSettingsComponent } from "@/components/settings/notification-settings"
import { SecuritySettingsComponent } from "@/components/settings/security-settings"
import { Card, CardContent } from "@/components/ui/card"
import { Key, User, Bell, Shield, Webhook, Lock, Network, Server } from "lucide-react"
import ProfileForm from "@/app/profile/ProfileForm"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

interface SettingsClientProps {
  user: any
  profile: any
}

// Tabs that render inline here (the others are Links that navigate away).
const INLINE_TABS = ["profile", "notifications", "security", "api-keys", "webhooks"]

export function SettingsClient({ user, profile }: SettingsClientProps) {
  const searchParams = useSearchParams()
  const requestedTab = searchParams.get("tab")
  const defaultTab = requestedTab && INLINE_TABS.includes(requestedTab) ? requestedTab : "profile"

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-6xl">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2 enterprise-text-gradient">Settings</h1>
        <p className="text-sm sm:text-base text-muted-foreground">Manage your account settings and preferences</p>
      </div>

      <Card className="enterprise-card glass-morphism border-none">
        <CardContent className="p-4 sm:p-6">
          <Tabs defaultValue={defaultTab} className="space-y-6">
            <TabsList className="inline-flex w-full overflow-x-auto overflow-y-hidden lg:grid lg:grid-cols-8 gap-1 scrollbar-hide bg-muted/50 backdrop-blur-sm">
              <TabsTrigger
                value="profile"
                className="flex items-center gap-2 text-xs sm:text-sm whitespace-nowrap flex-shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Profile</span>
                <span className="sm:hidden">Profile</span>
              </TabsTrigger>
              <TabsTrigger
                value="notifications"
                className="flex items-center gap-2 text-xs sm:text-sm whitespace-nowrap flex-shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Bell className="h-4 w-4" />
                <span className="hidden sm:inline">Notifications</span>
                <span className="sm:hidden">Notifs</span>
              </TabsTrigger>
              <TabsTrigger
                value="security"
                className="flex items-center gap-2 text-xs sm:text-sm whitespace-nowrap flex-shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">Security</span>
                <span className="sm:hidden">Security</span>
              </TabsTrigger>
              <TabsTrigger
                value="api-keys"
                className="flex items-center gap-2 text-xs sm:text-sm whitespace-nowrap flex-shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Key className="h-4 w-4" />
                <span className="hidden sm:inline">API Keys</span>
                <span className="sm:hidden">Keys</span>
              </TabsTrigger>
              <TabsTrigger
                value="webhooks"
                className="flex items-center gap-2 text-xs sm:text-sm whitespace-nowrap flex-shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Webhook className="h-4 w-4" />
                <span className="hidden sm:inline">Webhooks</span>
                <span className="sm:hidden">Hooks</span>
              </TabsTrigger>
              <TabsTrigger
                value="oauth"
                className="flex items-center gap-2 text-xs sm:text-sm whitespace-nowrap flex-shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                asChild
              >
                <Link href="/ai-suite/settings/oauth">
                  <Lock className="h-4 w-4" />
                  <span className="hidden sm:inline">OAuth 2.1</span>
                  <span className="sm:hidden">OAuth</span>
                </Link>
              </TabsTrigger>
              <TabsTrigger
                value="service-accounts"
                className="flex items-center gap-2 text-xs sm:text-sm whitespace-nowrap flex-shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                asChild
              >
                <Link href="/ai-suite/settings/service-accounts">
                  <Server className="h-4 w-4" />
                  <span className="hidden sm:inline">Service Accounts</span>
                  <span className="sm:hidden">SA</span>
                </Link>
              </TabsTrigger>
              <TabsTrigger
                value="aethernet"
                className="flex items-center gap-2 text-xs sm:text-sm whitespace-nowrap flex-shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                asChild
              >
                <Link href="/ai-suite/aethernet">
                  <Network className="h-4 w-4" />
                  <span className="hidden sm:inline">AetherNet</span>
                  <span className="sm:hidden">AetherNet</span>
                </Link>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-6">
              <ProfileForm initialData={profile} userId={user.id} />
            </TabsContent>

            <TabsContent value="notifications" className="space-y-6">
              <NotificationSettingsComponent />
            </TabsContent>

            <TabsContent value="security" className="space-y-6">
              <SecuritySettingsComponent />
            </TabsContent>

            <TabsContent value="api-keys" className="space-y-6">
              <APIKeyManagement />
            </TabsContent>

            <TabsContent value="webhooks" className="space-y-6">
              <WebhookManagement />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
