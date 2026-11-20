"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Bot,
  Workflow,
  Settings,
  Home,
  ChevronLeft,
  ChevronRight,
  Zap,
  Database,
  Users,
  Brain,
  Layers,
  Building,
  CreditCard,
  ChevronDown,
  Coins,
  Network,
  Mic,
  Calculator,
  Sun,
  Moon,
  Radar,
  Handshake,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useAISuite } from "@/components/ai-suite/providers"
import { useDashboardMetrics } from "@/lib/hooks/use-ai-suite"
import { useTheme } from "next-themes"

const navigationSections = [
  {
    title: "Overview",
    items: [{ name: "Dashboard", href: "/ai-suite", icon: Home, badge: null, description: "Overview & metrics" }],
  },
  {
    title: "AI Intelligence",
    items: [
      {
        name: "Asset Intelligence",
        href: "/ai-suite/asset-intelligence",
        icon: Building,
        badge: "assets",
        description: "Smart asset analysis",
      },
      { name: "AI Agents", href: "/ai-suite/agents", icon: Bot, badge: "agents", description: "Autonomous agents" },
      {
        name: "Workflows",
        href: "/ai-suite/workflows",
        icon: Workflow,
        badge: "workflows",
        description: "Automated processes",
      },
      {
        name: "Embeddings",
        href: "/ai-suite/embeddings",
        icon: Layers,
        badge: "embeddings",
        description: "Vector search",
      },
    ],
  },
  {
    title: "AI & Automation",
    items: [
      {
        name: "Voice Agent",
        href: "/ai-suite/voice-agent",
        icon: Mic,
        badge: null,
        description: "Voice commands & NLP",
      },
      {
        name: "IoT Command Center",
        href: "/ai-suite/iot",
        icon: Radar,
        badge: "iot",
        description: "Devices & critical infrastructure",
      },
    ],
  },
  {
    title: "Blockchain & Assets",
    items: [
      {
        name: "Tokenization",
        href: "/ai-suite/tokenization",
        icon: Coins,
        badge: "tokens",
        description: "Asset tokenization",
      },
      {
        name: "AetherNet QUAS",
        href: "/ai-suite/aethernet",
        icon: Network,
        badge: null,
        description: "Post-quantum settlement",
      },
      {
        name: "Live A2A Demo",
        href: "/ai-suite/a2a-demo",
        icon: Handshake,
        badge: null,
        description: "Agents settling a deal",
      },
    ],
  },
  {
    title: "Analytics & Tools",
    items: [
      {
        name: "ROI Analytics",
        href: "/ai-suite/roi-analytics",
        icon: Calculator,
        badge: null,
        description: "AI investment ROI",
      },
      {
        name: "Integrations",
        href: "/ai-suite/integrations",
        icon: Zap,
        badge: null,
        description: "Connected services",
      },
      {
        name: "Databases",
        href: "/ai-suite/managed-databases",
        icon: Database,
        badge: null,
        description: "Data management",
      },
    ],
  },
  {
    title: "Organization",
    items: [
      { name: "Teams", href: "/ai-suite/teams", icon: Users, badge: null, description: "Team collaboration" },
      {
        name: "Subscriptions",
        href: "/ai-suite/subscriptions",
        icon: CreditCard,
        badge: null,
        description: "Billing & plans",
      },
      { name: "Settings", href: "/ai-suite/settings", icon: Settings, badge: null, description: "Preferences" },
    ],
  },
]

interface DashboardSidebarProps {
  isMobile?: boolean
  onNavigate?: () => void
}

export function DashboardSidebar({ isMobile = false, onNavigate }: DashboardSidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["Overview", "AI Intelligence"]))
  const pathname = usePathname()
  const { user } = useAISuite()
  const { data: metrics } = useDashboardMetrics()
  const { theme, setTheme } = useTheme()

  const handleNavClick = () => {
    if (isMobile && onNavigate) {
      onNavigate()
    }
  }

  const toggleSection = (title: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(title)) {
      newExpanded.delete(title)
    } else {
      newExpanded.add(title)
    }
    setExpandedSections(newExpanded)
  }

  const getBadgeCount = (badgeType: string | null) => {
    if (!metrics || !badgeType) return null

    switch (badgeType) {
      case "assets":
        return metrics.totalAssets
      case "agents":
        return metrics.totalAgents
      case "workflows":
        return metrics.activeWorkflows
      case "embeddings":
        return metrics.totalEmbeddings
      case "tokens":
        return metrics.totalTokenizedAssets
      case "iot":
        return metrics.totalIoTDevices || 0
      default:
        return null
    }
  }

  if (isMobile) {
    return (
      <div className="flex flex-col h-full bg-background">
        {/* Header */}
        <div className="p-6 border-b border-border/50 bg-gradient-to-br from-primary/5 via-primary/3 to-transparent">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-primary via-primary/90 to-primary/80 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/25">
                <Brain className="w-6 h-6 text-primary-foreground" />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-background animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-xl tracking-tight">AI Suite</h2>
              <p className="text-sm text-muted-foreground font-medium">Enterprise Platform</p>
            </div>
            <Badge
              variant="secondary"
              className="h-7 px-3 font-semibold bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20"
            >
              Live
            </Badge>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-6 overflow-y-auto overscroll-contain">
          {navigationSections.map((section) => {
            const isExpanded = expandedSections.has(section.title)

            return (
              <div key={section.title}>
                <button
                  onClick={() => toggleSection(section.title)}
                  className="flex items-center justify-between w-full px-2 py-2 mb-2 text-xs font-bold tracking-wider text-muted-foreground uppercase hover:text-foreground transition-colors"
                >
                  {section.title}
                  <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </motion.div>
                </button>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="space-y-1 overflow-hidden"
                    >
                      {section.items.map((item) => {
                        const isActive = pathname === item.href
                        const badgeCount = getBadgeCount(item.badge)

                        return (
                          <Link key={item.name} href={item.href} onClick={handleNavClick}>
                            <motion.div
                              whileTap={{ scale: 0.98 }}
                              className={cn(
                                "group relative flex items-center justify-between px-4 py-3.5 rounded-xl border transition-all duration-200 min-h-[52px]",
                                isActive
                                  ? "bg-gradient-to-r from-primary/15 to-accent/5 text-foreground border-primary/30 shadow-sm"
                                  : "border-transparent hover:bg-accent/50 active:bg-accent",
                              )}
                            >
                              {isActive && (
                                <span
                                  aria-hidden="true"
                                  className="absolute left-0 top-1/2 -translate-y-1/2 h-7 w-1 rounded-r-full bg-gradient-to-b from-primary to-accent"
                                />
                              )}
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div
                                  className={cn(
                                    "w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0",
                                    isActive
                                      ? "bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-md shadow-primary/25"
                                      : "bg-gradient-to-br from-primary/10 to-accent/20 text-primary group-hover:from-primary/20 group-hover:to-accent/30 group-hover:scale-105",
                                  )}
                                >
                                  <item.icon className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-sm leading-none mb-1">{item.name}</p>
                                  <p className="text-xs leading-none truncate text-muted-foreground">
                                    {item.description}
                                  </p>
                                </div>
                              </div>
                              {badgeCount !== null && badgeCount !== undefined && (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "h-7 min-w-[28px] px-2.5 font-bold text-xs shrink-0 ml-2",
                                    isActive && "bg-primary/15 text-primary border-primary/30",
                                  )}
                                >
                                  {badgeCount}
                                </Badge>
                              )}
                            </motion.div>
                          </Link>
                        )
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </nav>

        {/* Added theme toggle and user profile in footer */}
        <div className="p-4 border-t border-border/50 bg-muted/20 space-y-3">
          {/* Theme Toggle */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-full flex items-center justify-between p-3.5 rounded-xl bg-card hover:bg-accent/50 transition-all shadow-sm border border-border/50"
          >
            <span className="text-sm font-semibold">Theme</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground capitalize">{theme === "dark" ? "Dark" : "Light"}</span>
              {theme === "dark" ? <Moon className="h-4 w-4 text-primary" /> : <Sun className="h-4 w-4 text-primary" />}
            </div>
          </motion.button>

          {/* User Profile */}
          <motion.div
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-3 p-3.5 rounded-xl bg-card hover:bg-accent/50 transition-all cursor-pointer shadow-sm border border-border/50 min-h-[64px]"
          >
            <div className="relative shrink-0">
              <div className="w-11 h-11 bg-gradient-to-br from-primary via-primary/90 to-primary/80 rounded-full flex items-center justify-center shadow-md">
                <span className="text-base font-bold text-primary-foreground">{user.email?.[0]?.toUpperCase()}</span>
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-card" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate leading-none mb-1.5">{user.email}</p>
              <p className="text-xs text-muted-foreground font-medium leading-none">Enterprise Account</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 280 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="bg-card/50 backdrop-blur-xl border-r border-border/50 flex flex-col hidden lg:flex shrink-0"
    >
      {/* Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-border/50 shrink-0">
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-3"
            >
              <div className="relative">
                <div className="w-9 h-9 bg-gradient-to-br from-primary via-primary/90 to-primary/80 rounded-xl flex items-center justify-center shadow-lg shadow-primary/25">
                  <Brain className="w-5 h-5 text-primary-foreground" />
                </div>
                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-card animate-pulse" />
              </div>
              <div>
                <h2 className="font-bold text-base tracking-tight leading-none">AI Suite</h2>
                <p className="text-xs text-muted-foreground font-medium">Enterprise</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className={cn("h-8 w-8 rounded-lg hover:bg-accent transition-all shrink-0", collapsed && "mx-auto")}
        >
          <motion.div animate={{ rotate: collapsed ? 0 : 180 }} transition={{ duration: 0.3 }}>
            <ChevronLeft className="w-4 h-4" />
          </motion.div>
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-5 overflow-y-auto overflow-x-hidden overscroll-contain">
        {navigationSections.map((section, sectionIdx) => {
          const isExpanded = expandedSections.has(section.title)

          return (
            <div key={section.title}>
              {!collapsed && (
                <>
                  {sectionIdx > 0 && <Separator className="my-4" />}
                  <button
                    onClick={() => toggleSection(section.title)}
                    className="flex items-center justify-between w-full px-3 py-2 mb-2 text-xs font-bold tracking-wider text-muted-foreground uppercase hover:text-foreground transition-colors group"
                  >
                    <span className="truncate">{section.title}</span>
                    <motion.div
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="shrink-0 ml-2"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </motion.div>
                  </button>
                </>
              )}

              <AnimatePresence initial={false}>
                {(collapsed || isExpanded) && (
                  <motion.div
                    initial={collapsed ? {} : { height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={collapsed ? {} : { height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="space-y-1 overflow-hidden"
                  >
                    {section.items.map((item) => {
                      const isActive = pathname === item.href
                      const badgeCount = getBadgeCount(item.badge)

                      const linkContent = (
                        <Link key={item.name} href={item.href}>
                          <motion.div
                            whileHover={{ scale: 1.02, x: 2 }}
                            whileTap={{ scale: 0.98 }}
                            className={cn(
                              "relative flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-200 group",
                              isActive
                                ? "bg-gradient-to-r from-primary/15 to-accent/5 text-foreground border-primary/30 shadow-sm"
                                : "border-transparent hover:bg-accent/50",
                              collapsed && "justify-center px-2",
                            )}
                          >
                            {isActive && (
                              <motion.div
                                layoutId="activeIndicator"
                                className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-primary to-accent rounded-r-full"
                                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                              />
                            )}
                            <div
                              className={cn(
                                "rounded-lg flex items-center justify-center transition-all shrink-0",
                                collapsed ? "w-7 h-7" : "w-9 h-9",
                                isActive
                                  ? "bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-md shadow-primary/25"
                                  : "bg-gradient-to-br from-primary/10 to-accent/20 text-primary group-hover:from-primary/20 group-hover:to-accent/30 group-hover:scale-105",
                              )}
                            >
                              <item.icon className={cn(collapsed ? "w-4 h-4" : "w-[18px] h-[18px]")} />
                            </div>
                            {!collapsed && (
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm leading-none truncate">{item.name}</p>
                                <p className="text-xs leading-none mt-1 truncate text-muted-foreground">
                                  {item.description}
                                </p>
                              </div>
                            )}
                            {!collapsed && badgeCount !== null && badgeCount !== undefined && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "h-6 min-w-[24px] px-2 font-bold text-xs shrink-0",
                                  isActive && "bg-primary/15 text-primary border-primary/30",
                                )}
                              >
                                {badgeCount}
                              </Badge>
                            )}
                          </motion.div>
                        </Link>
                      )

                      if (collapsed) {
                        return (
                          <TooltipProvider key={item.name} delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                              <TooltipContent side="right" className="font-semibold">
                                <p>{item.name}</p>
                                <p className="text-xs text-muted-foreground font-normal">{item.description}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )
                      }

                      return linkContent
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </nav>

      {/* Added theme toggle and user profile in footer */}
      <div className="p-3 border-t border-border/50 shrink-0 bg-muted/20 space-y-2">
        {/* Theme Toggle */}
        {!collapsed && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-full flex items-center justify-between p-2.5 rounded-xl bg-card hover:bg-accent/50 transition-all shadow-sm border border-border/30"
          >
            <span className="text-sm font-semibold">Theme</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground capitalize">{theme === "dark" ? "Dark" : "Light"}</span>
              {theme === "dark" ? <Moon className="h-4 w-4 text-primary" /> : <Sun className="h-4 w-4 text-primary" />}
            </div>
          </motion.button>
        )}
        {collapsed && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-full flex items-center justify-center p-2.5 rounded-xl bg-card hover:bg-accent/50 transition-all shadow-sm border border-border/30"
          >
            {theme === "dark" ? <Moon className="h-4 w-4 text-primary" /> : <Sun className="h-4 w-4 text-primary" />}
          </motion.button>
        )}

        {/* User Profile */}
        <motion.div
          whileHover={{ scale: collapsed ? 1.05 : 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={cn(
            "flex items-center gap-3 p-2.5 rounded-xl bg-card hover:bg-accent/50 transition-all cursor-pointer shadow-sm border border-border/30",
            collapsed && "justify-center",
          )}
        >
          <div className="relative shrink-0">
            <div className="w-9 h-9 bg-gradient-to-br from-primary via-primary/90 to-primary/80 rounded-full flex items-center justify-center shadow-md">
              <span className="text-sm font-bold text-primary-foreground">{user.email?.[0]?.toUpperCase()}</span>
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-card" />
          </div>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 min-w-0"
            >
              <p className="text-sm font-semibold truncate leading-none">{user.email}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-none">Enterprise</p>
            </motion.div>
          )}
        </motion.div>
      </div>
    </motion.aside>
  )
}
