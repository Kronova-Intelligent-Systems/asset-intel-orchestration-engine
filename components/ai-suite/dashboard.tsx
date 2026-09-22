"use client"
import { motion } from "framer-motion"
import {
  Bot,
  TrendingUp,
  Brain,
  Plus,
  Activity,
  ArrowUpRight,
  Building,
  Database,
  Workflow,
  BarChart3,
  Layers,
  Cpu,
  Target,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line } from "recharts"
import {
  useDashboardMetrics,
  useAIAgents,
  useAIWorkflows,
  useAssets,
  useRealtimeSubscription,
} from "@/lib/hooks/use-ai-suite"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { AILogsDashboard } from "@/components/ai-suite/ai-logs-dashboard"

interface DashboardProps {
  user: any
}

const agentDistribution = [
  { name: "GPT-4", value: 35, color: "var(--chart-1)" },
  { name: "Claude", value: 25, color: "var(--chart-2)" },
  { name: "Gemini", value: 20, color: "var(--chart-3)" },
  { name: "Custom", value: 20, color: "var(--chart-4)" },
]

const mockChartData = [
  { name: "Jan", requests: 4000, success: 3800, cost: 2400, assets: 1200 },
  { name: "Feb", requests: 3000, success: 2900, cost: 1398, assets: 1220 },
  { name: "Mar", requests: 2000, success: 1950, cost: 9800, assets: 1235 },
  { name: "Apr", requests: 2780, success: 2700, cost: 3908, assets: 1247 },
  { name: "May", requests: 1890, success: 1850, cost: 4800, assets: 1250 },
  { name: "Jun", requests: 2390, success: 2300, cost: 3800, assets: 1247 },
]

export function AISuiteDashboard({ user }: DashboardProps) {
  const { resolvedTheme } = useTheme()
  const [chartLabelColor, setChartLabelColor] = useState("#6b7280")
  const [gridColor, setGridColor] = useState("#e5e7eb")

  useEffect(() => {
    if (resolvedTheme === "dark") {
      setChartLabelColor("#9ca3af")
      setGridColor("#374151")
    } else {
      setChartLabelColor("#6b7280")
      setGridColor("#e5e7eb")
    }
  }, [resolvedTheme])

  const { data: metrics, isLoading: metricsLoading } = useDashboardMetrics()
  const { data: agents } = useAIAgents()
  const { data: workflows } = useAIWorkflows()
  const { data: assets } = useAssets()

  useRealtimeSubscription("ai_agents", () => {})
  useRealtimeSubscription("ai_workflows", () => {})
  useRealtimeSubscription("assets", () => {})
  useRealtimeSubscription("ai_workflow_runs", () => {})

  const displayMetrics = metrics || {
    totalAgents: 0,
    activeWorkflows: 0,
    totalRequests: 0,
    successRate: 0,
    avgResponseTime: 0,
    costSavings: 0,
    totalAssets: 0,
    assetValue: 0,
    avgUtilization: 0,
    esgScore: 0,
    recentAnalysis: 0,
    totalEmbeddings: 0,
    recentWorkflowRuns: [],
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 dark:from-background dark:via-background dark:to-muted/10">
      <main className="p-3 lg:p-6">
        <div className="mb-4 lg:mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3"
          >
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-foreground dark:text-white">
                Welcome back, {user?.email?.split("@")[0]}
              </h1>
              <p className="text-xs lg:text-sm text-muted-foreground dark:text-gray-400">
                Kronova Real Time Analytics
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                asChild
                className="dark:border-gray-700 dark:hover:bg-gray-800 bg-transparent"
              >
                <Link href="/ai-suite/asset-intelligence">
                  <Building className="w-3 h-3 mr-1" />
                  Asset Intelligence
                </Link>
              </Button>
              <Button size="sm" className="gap-1 enterprise-button">
                <Plus className="w-3 h-3" />
                New Agent
              </Button>
            </div>
          </motion.div>
        </div>

        <div className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 lg:grid-cols-6 gap-2 lg:gap-4"
          >
            <Card className="enterprise-card group hover:scale-[1.02] transition-all duration-300">
              <CardContent className="p-3 lg:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="dashboard-metric-label text-xs dark:text-gray-400">AI Agents</p>
                    <p className="dashboard-metric-value text-lg lg:text-xl dark:text-white">
                      {metricsLoading ? "..." : displayMetrics.totalAgents}
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Bot className="w-4 h-4 lg:w-5 lg:h-5 text-primary" />
                  </div>
                </div>
                <div className="mt-1 lg:mt-2">
                  <div className="flex items-center gap-1">
                    <ArrowUpRight className="h-2 w-2 text-green-500 dark:text-green-400" />
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium">Live</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="enterprise-card group hover:scale-[1.02] transition-all duration-300">
              <CardContent className="p-3 lg:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="dashboard-metric-label text-xs dark:text-gray-400">Workflows</p>
                    <p className="dashboard-metric-value text-lg lg:text-xl dark:text-white">
                      {metricsLoading ? "..." : displayMetrics.activeWorkflows}
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 dark:bg-cyan-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Workflow className="w-4 h-4 lg:w-5 lg:h-5 text-cyan-500" />
                  </div>
                </div>
                <div className="mt-1 lg:mt-2">
                  <div className="flex items-center gap-1">
                    <Activity className="h-2 w-2 text-blue-500 dark:text-blue-400" />
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Active</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="enterprise-card group hover:scale-[1.02] transition-all duration-300">
              <CardContent className="p-3 lg:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="dashboard-metric-label text-xs dark:text-gray-400">Assets</p>
                    <p className="dashboard-metric-value text-lg lg:text-xl dark:text-white">
                      {metricsLoading ? "..." : displayMetrics.totalAssets}
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Building className="w-4 h-4 lg:w-5 lg:h-5 text-emerald-500" />
                  </div>
                </div>
                <div className="mt-1 lg:mt-2">
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-2 w-2 text-green-500 dark:text-green-400" />
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                      {displayMetrics.avgUtilization}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="enterprise-card group hover:scale-[1.02] transition-all duration-300">
              <CardContent className="p-3 lg:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="dashboard-metric-label text-xs dark:text-gray-400">Success Rate</p>
                    <p className="dashboard-metric-value text-lg lg:text-xl dark:text-white">
                      {metricsLoading ? "..." : `${displayMetrics.successRate}%`}
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-violet-500/10 dark:bg-violet-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Target className="w-4 h-4 lg:w-5 lg:h-5 text-violet-500" />
                  </div>
                </div>
                <div className="mt-1 lg:mt-2">
                  <div className="h-1 bg-muted dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-cyan-500"
                      style={{ width: `${displayMetrics.successRate}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="enterprise-card group hover:scale-[1.02] transition-all duration-300">
              <CardContent className="p-3 lg:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="dashboard-metric-label text-xs dark:text-gray-400">Embeddings</p>
                    <p className="dashboard-metric-value text-lg lg:text-xl dark:text-white">
                      {metricsLoading ? "..." : displayMetrics.totalEmbeddings}
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 dark:bg-purple-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Database className="w-4 h-4 lg:w-5 lg:h-5 text-purple-500" />
                  </div>
                </div>
                <div className="mt-1 lg:mt-2">
                  <div className="flex items-center gap-1">
                    <Layers className="h-2 w-2 text-purple-500 dark:text-purple-400" />
                    <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">Vectors</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="enterprise-card group hover:scale-[1.02] transition-all duration-300">
              <CardContent className="p-3 lg:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="dashboard-metric-label text-xs dark:text-gray-400">Analysis</p>
                    <p className="dashboard-metric-value text-lg lg:text-xl dark:text-white">
                      {metricsLoading ? "..." : displayMetrics.recentAnalysis}
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-orange-500/10 dark:bg-orange-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <BarChart3 className="w-4 h-4 lg:w-5 lg:h-5 text-orange-500" />
                  </div>
                </div>
                <div className="mt-1 lg:mt-2">
                  <div className="flex items-center gap-1">
                    <Cpu className="h-2 w-2 text-orange-500 dark:text-orange-400" />
                    <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">7d</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card className="enterprise-card relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-cyan-500/5 to-primary/5 dark:from-primary/10 dark:via-cyan-500/10 dark:to-primary/10" />
              <CardContent className="p-4 lg:p-5 relative">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-primary to-cyan-500 rounded-lg flex items-center justify-center shadow-lg shadow-primary/25">
                      <Activity className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm lg:text-base text-foreground dark:text-white">
                        Asset Intelligence Dashboard
                      </h3>
                      <p className="text-xs text-muted-foreground dark:text-gray-400">
                        Monitor {displayMetrics.totalAssets} assets with AI-powered insights and real-time analytics
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right hidden lg:block">
                      <p className="text-xs font-medium text-foreground dark:text-white">
                        Value: ${(displayMetrics.assetValue / 1000000).toFixed(1)}M
                      </p>
                      <p className="text-xs text-muted-foreground dark:text-gray-400">
                        ESG: {displayMetrics.esgScore}/10
                      </p>
                    </div>
                    <Button size="sm" asChild className="enterprise-button">
                      <Link href="/ai-suite/asset-intelligence">
                        View Dashboard
                        <ArrowUpRight className="w-3 h-3 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
              <Card className="enterprise-card">
                <CardHeader className="pb-2 lg:pb-4">
                  <CardTitle className="text-sm lg:text-base text-foreground dark:text-white">
                    AI Request Volume
                  </CardTitle>
                  <CardDescription className="text-xs dark:text-gray-400">
                    Real-time agent requests and success rates
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={mockChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} strokeOpacity={0.5} />
                      <XAxis
                        dataKey="name"
                        stroke={chartLabelColor}
                        tick={{ fill: chartLabelColor, fontSize: 10 }}
                        axisLine={{ stroke: gridColor }}
                        tickLine={{ stroke: gridColor }}
                      />
                      <YAxis
                        stroke={chartLabelColor}
                        tick={{ fill: chartLabelColor, fontSize: 10 }}
                        axisLine={{ stroke: gridColor }}
                        tickLine={{ stroke: gridColor }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: resolvedTheme === "dark" ? "#1f2937" : "#ffffff",
                          border: `1px solid ${resolvedTheme === "dark" ? "#374151" : "#e5e7eb"}`,
                          borderRadius: "8px",
                          fontSize: "11px",
                          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                          color: resolvedTheme === "dark" ? "#f3f4f6" : "#1f2937",
                        }}
                        labelStyle={{
                          color: resolvedTheme === "dark" ? "#f3f4f6" : "#1f2937",
                          fontWeight: 600,
                        }}
                        itemStyle={{
                          color: resolvedTheme === "dark" ? "#d1d5db" : "#4b5563",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="requests"
                        stroke="var(--primary)"
                        fill="var(--primary)"
                        fillOpacity={0.2}
                        name="Requests"
                      />
                      <Area
                        type="monotone"
                        dataKey="success"
                        stroke="#00CED1"
                        fill="#00CED1"
                        fillOpacity={0.2}
                        name="Success"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
              <Card className="enterprise-card">
                <CardHeader className="pb-2 lg:pb-4">
                  <CardTitle className="text-sm lg:text-base text-foreground dark:text-white">
                    Asset Growth Trend
                  </CardTitle>
                  <CardDescription className="text-xs dark:text-gray-400">
                    Asset count and value progression
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={mockChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} strokeOpacity={0.5} />
                      <XAxis
                        dataKey="name"
                        stroke={chartLabelColor}
                        tick={{ fill: chartLabelColor, fontSize: 10 }}
                        axisLine={{ stroke: gridColor }}
                        tickLine={{ stroke: gridColor }}
                      />
                      <YAxis
                        stroke={chartLabelColor}
                        tick={{ fill: chartLabelColor, fontSize: 10 }}
                        axisLine={{ stroke: gridColor }}
                        tickLine={{ stroke: gridColor }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: resolvedTheme === "dark" ? "#1f2937" : "#ffffff",
                          border: `1px solid ${resolvedTheme === "dark" ? "#374151" : "#e5e7eb"}`,
                          borderRadius: "8px",
                          fontSize: "11px",
                          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                          color: resolvedTheme === "dark" ? "#f3f4f6" : "#1f2937",
                        }}
                        labelStyle={{
                          color: resolvedTheme === "dark" ? "#f3f4f6" : "#1f2937",
                          fontWeight: 600,
                        }}
                        itemStyle={{
                          color: resolvedTheme === "dark" ? "#d1d5db" : "#4b5563",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="assets"
                        stroke="#00CED1"
                        strokeWidth={2}
                        dot={{ fill: "#00CED1", strokeWidth: 2, r: 3 }}
                        name="Assets"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card className="enterprise-card">
              <CardHeader className="pb-2 lg:pb-4">
                <CardTitle className="text-sm lg:text-base text-foreground dark:text-white">Recent Activity</CardTitle>
                <CardDescription className="text-xs dark:text-gray-400">
                  Latest AI agent interactions and workflow executions (real-time)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 lg:space-y-3">
                  {displayMetrics.recentWorkflowRuns?.slice(0, 5).map((run: any, index: number) => (
                    <div
                      key={run.id || index}
                      className="flex items-center justify-between p-2 lg:p-3 border border-border dark:border-gray-700 rounded-lg bg-card/50 dark:bg-gray-800/50 hover:bg-muted/50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 lg:w-8 lg:h-8 bg-gradient-to-br from-primary to-cyan-500 rounded-full flex items-center justify-center">
                          <Brain className="w-3 h-3 lg:w-4 lg:h-4 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-xs lg:text-sm text-foreground dark:text-white">
                            Workflow {run.workflow_id ? `#${run.workflow_id.slice(-8)}` : "System"} executed
                          </p>
                          <p className="text-xs text-muted-foreground dark:text-gray-400">
                            {new Date(run.created_at).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      <Badge
                        className={`text-xs ${
                          run.status === "completed"
                            ? "bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30"
                            : run.status === "running"
                              ? "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30"
                              : "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30"
                        }`}
                        variant="outline"
                      >
                        {run.status || "Unknown"}
                      </Badge>
                    </div>
                  )) ||
                    [1, 2, 3].map((item) => (
                      <div
                        key={item}
                        className="flex items-center justify-between p-2 lg:p-3 border border-border dark:border-gray-700 rounded-lg bg-card/50 dark:bg-gray-800/50"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 lg:w-8 lg:h-8 bg-gradient-to-br from-primary/50 to-cyan-500/50 rounded-full flex items-center justify-center animate-pulse">
                            <Brain className="w-3 h-3 lg:w-4 lg:h-4 text-white/70" />
                          </div>
                          <div>
                            <p className="font-medium text-xs lg:text-sm text-foreground dark:text-white">
                              Loading activity...
                            </p>
                            <p className="text-xs text-muted-foreground dark:text-gray-400">
                              Connecting to real-time data
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-xs bg-muted/50 dark:bg-gray-700/50 border-border dark:border-gray-600"
                        >
                          Loading
                        </Badge>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* AI Request Logs & Analytics */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <AILogsDashboard />
          </motion.div>
        </div>
      </main>
    </div>
  )
}
