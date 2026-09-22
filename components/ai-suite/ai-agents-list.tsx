"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Loader2, Plus, Bot, Trash2, Play, Edit, Sparkles, Zap, TrendingUp } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { createAgent, updateAgent, deleteAgent, executeAgent } from "@/app/actions/ai-actions"
import { getAssets } from "@/app/actions/asset-intelligence-actions" // Import getAssets action
import type { AIModel } from "@/lib/types/database"
import type { CreateAIAgent } from "@/lib/schemas/ai"
import { AgentTemplateSelector } from "./agent-template-selector"
import type { AgentTemplate } from "@/lib/ai/agent-templates"
import { ScrollArea } from "@/components/ui/scroll-area" // Import ScrollArea
import { DataSourceSelector } from "@/components/asset-intelligence/data-source-selector"
import { DataStreamSelector } from "@/components/ai-suite/data-stream-selector"
import { saveToLearningLayer } from "@/app/actions/learning-layer-actions"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { AgentExecutionReport } from "./agent-execution-report"
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { motion, AnimatePresence } from "framer-motion"

interface AIAgentsListProps {
  agents: any[]
  user: any
  aiModels: AIModel[]
  initialAssets?: any[]
}

// Helper function to format tool names
const formatToolName = (tool: any): string => {
  if (!tool) {
    return "Unknown Tool"
  }

  if (typeof tool === "string") {
    return tool.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
  }

  // Handle objects with name property
  if (tool.name && typeof tool.name === "string") {
    return tool.name.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
  }

  // Handle objects with type property
  if (tool.type && typeof tool.type === "string") {
    return tool.type.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
  }

  // Handle objects with function.name
  if (tool.function?.name && typeof tool.function.name === "string") {
    return tool.function.name.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
  }

  // Fallback for objects without recognizable properties
  return "Custom Tool"
}

export function AIAgentsList({ agents, user, aiModels, initialAssets = [] }: AIAgentsListProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<any>(null)
  const [executionPrompt, setExecutionPrompt] = useState("")
  const [executionResult, setExecutionResult] = useState<any>(null)
  const [selectedAssets, setSelectedAssets] = useState<string[]>([])
  const [availableAssets, setAvailableAssets] = useState<any[]>(initialAssets)
  const [assetsLoading, setAssetsLoading] = useState(false)
  const [assetsError, setAssetsError] = useState<string | null>(null)
  const [selectedTables, setSelectedTables] = useState<string[]>([])
  const [selectedEndpoints, setSelectedEndpoints] = useState<string[]>([])
  const [includeLearningData, setIncludeLearningData] = useState(false)
  const [selectedDataStreams, setSelectedDataStreams] = useState<string[]>([])
  const [saveToLearning, setSaveToLearning] = useState(false)

  const getDefaultModelId = () => {
    if (!aiModels || aiModels.length === 0) return ""
    return aiModels[0]?.id || ""
  }

  const [formData, setFormData] = useState<CreateAIAgent>({
    name: "",
    description: "",
    system_prompt: "",
    model_id: getDefaultModelId(),
    max_tokens: 1000,
    temperature: 0.7,
  })
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const [isSelectingTemplate, setIsSelectingTemplate] = useState(false)
  const [selectedTools, setSelectedTools] = useState<string[]>([])

  // This eliminates the problematic Server Action call during initial page load
  useEffect(() => {
    console.log("[v0] AIAgentsList - Initialized with assets:", {
      count: initialAssets.length,
      timestamp: new Date().toISOString(),
    })
  }, [initialAssets])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleTemplateSelect = (template: AgentTemplate) => {
    setFormData({
      name: template.name,
      description: template.description,
      system_prompt: template.systemPrompt,
      model_id: getDefaultModelId(), // Use safe function instead of direct array access
      max_tokens: template.parameters.max_tokens,
      temperature: template.parameters.temperature,
    })
    setSelectedTools(template.tools)
    setIsSelectingTemplate(false)
    setIsCreating(true)
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSliderChange = (name: string, value: number[]) => {
    setFormData((prev) => ({ ...prev, [name]: value[0] }))
  }

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      system_prompt: "",
      model_id: getDefaultModelId(), // Use safe function instead of direct array access
      max_tokens: 1000,
      temperature: 0.7,
    })
    setSelectedTools([])
  }

  const handleEditAgent = (agent: any) => {
    setSelectedAgent(agent)
    setFormData({
      name: agent.name,
      description: agent.description || "",
      system_prompt: agent.system_prompt || "",
      model_id: agent.model_id,
      max_tokens: agent.max_tokens || 1000,
      temperature: agent.parameters?.temperature || 0.7,
    })
    // Safely extract tool names, handling various tool formats
    const toolNames = agent.tools ? agent.tools.map((tool: any) => {
      if (!tool) return null
      if (typeof tool === "string") return tool
      if (tool.name) return tool.name
      if (tool.function?.name) return tool.function.name
      return null
    }).filter(Boolean) : []
    setSelectedTools(toolNames)
    setIsEditing(true)
  }

  const handleUpdateAgent = async () => {
    if (!selectedAgent) return

    setIsLoading(true)
    try {
      const result = await updateAgent({
        id: selectedAgent.id,
        ...formData,
        user_id: user.id,
        tools: selectedTools,
      })

      if (result.success) {
        toast({
          title: "Agent updated",
          description: "Your AI agent has been updated successfully.",
        })
        setIsEditing(false)
        setSelectedAgent(null)
        resetForm()
        window.location.reload()
      } else {
        toast({
          title: "Error",
          description: result.message || result.error || "Failed to update agent",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error updating agent:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteAgent = async (agentId: string) => {
    if (!confirm("Are you sure you want to delete this agent?")) return

    try {
      const result = await deleteAgent(agentId)

      if (result.success) {
        toast({
          title: "Agent deleted",
          description: "Your AI agent has been deleted successfully.",
        })
        window.location.reload()
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to delete agent",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error deleting agent:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleExecuteAgent = async (agent: any) => {
    setSelectedAgent(agent)
    setExecutionPrompt("")
    setExecutionResult(null)
    setSelectedAssets([])
    setSelectedTables([])
    setSelectedEndpoints([])
    setIncludeLearningData(false)
    setSelectedDataStreams([])
    setSaveToLearning(false)
    setIsExecuting(true)

    // Fetch assets including IoT sensors
    setAssetsLoading(true)
    setAssetsError(null)
    try {
      const result = await getAssets()
      if (result.success && result.data) {
        setAvailableAssets(result.data)
        console.log("[v0] AI Agents - Assets loaded:", {
          total: result.data.length,
          regular: result.data.filter((a: any) => !a.metadata?.is_iot_sensor).length,
          iot: result.data.filter((a: any) => a.metadata?.is_iot_sensor).length,
        })
      } else {
        setAssetsError(result.error || "Failed to load assets")
      }
    } catch (error) {
      console.error("[v0] AI Agents - Error loading assets:", error)
      setAssetsError("Failed to load assets")
    } finally {
      setAssetsLoading(false)
    }
  }

  const runAgent = async () => {
    if (!selectedAgent || !executionPrompt.trim()) return

    setIsLoading(true)
    setExecutionResult(null)

    try {
      const context: any = {}
      if (selectedAssets.length > 0) {
        context.assetIds = selectedAssets
      }
      if (selectedTables.length > 0) {
        context.tables = selectedTables
      }
      if (selectedEndpoints.length > 0) {
        context.endpoints = selectedEndpoints
      }
      if (includeLearningData) {
        context.includeLearningData = true
      }
      if (selectedDataStreams.length > 0) {
        context.dataStreamIds = selectedDataStreams
      }

      const result = await executeAgent({
        agentId: selectedAgent.id,
        prompt: executionPrompt,
        ...context,
      })

      if (result.success) {
        setExecutionResult(result.data)

        if (saveToLearning && result.data) {
          const learningResult = await saveToLearningLayer({
            name: `Agent Execution: ${selectedAgent.name}`,
            description: `Execution of agent ${selectedAgent.name} with prompt: ${executionPrompt.substring(0, 100)}...`,
            executionType: "agent",
            executionId: selectedAgent.id,
            executionName: selectedAgent.name,
            assetIds: selectedAssets.length > 0 ? selectedAssets : undefined,
            executionInput: {
              prompt: executionPrompt,
              assetIds: selectedAssets,
              tables: selectedTables,
              endpoints: selectedEndpoints,
              dataStreams: selectedDataStreams,
            },
            executionOutput: {
              response: result.data.finalResponse,
              toolCalls: result.data.toolCalls || [],
            },
            executionMetrics: {
              tokens: result.data.tokens,
              elapsedMs: result.data.elapsedMs,
              iterations: result.data.iterations,
            },
            tags: ["agent", selectedAgent.name, ...selectedTables, ...selectedEndpoints],
          })

          if (learningResult.success) {
            toast({
              title: "Saved to Learning Layer",
              description: "This execution has been saved for future AI optimization.",
            })
          }
        }
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to execute agent",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error executing agent:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateAgent = async () => {
    setIsLoading(true)
    try {
      const result = await createAgent({
        ...formData,
        user_id: user.id,
        tools: selectedTools,
      })

      if (result.success) {
        toast({
          title: "Agent created",
          description: "Your AI agent has been created successfully.",
        })
        setIsCreating(false)
        resetForm()
        window.location.reload()
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to create agent",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error creating agent:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (!aiModels || aiModels.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">AI Agents</h2>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-6">
            <Bot className="h-12 w-12 mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No AI Models Available</h3>
            <p className="text-muted-foreground text-center mb-4">
              No AI models are currently available. Please check your configuration or contact support.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-primary via-purple-600 to-pink-600 bg-clip-text text-transparent">
              AI Agents
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Deploy intelligent agents to automate workflows and generate insights
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => setIsCreating(true)}
                  className="w-full sm:w-auto shadow-lg hover:shadow-xl transition-all"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Create Custom</span>
                  <span className="sm:hidden">Create</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Create a custom AI agent from scratch</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" onClick={() => setIsSelectingTemplate(true)} className="w-full sm:w-auto">
                  <Sparkles className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Use Template</span>
                  <span className="sm:hidden">Template</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Start with a pre-configured agent template</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {agents.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-6">
              <Bot className="h-12 w-12 mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No Agents Found</h3>
              <p className="text-muted-foreground text-center mb-4">
                You haven't created any AI agents yet. Create your first agent to get started.
              </p>
              <div className="flex flex-col gap-2">
                <Button onClick={() => setIsCreating(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Custom Agent
                </Button>
                <Button variant="outline" onClick={() => setIsSelectingTemplate(true)}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Use Preconfigured Template
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="grid gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {agents.map((agent, index) => (
                <motion.div
                  key={agent.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                >
                  {/* Enhanced agent card styling */}
                  <Card className="enterprise-card group relative overflow-hidden border border-border/50">
                    {/* Holographic border effect — desktop hover + mobile long-press */}
                    <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity duration-500 pointer-events-none">
                      <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary/20 via-transparent to-accent/20" />
                    </div>

                    {/* Animated gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity duration-500 pointer-events-none" />

                    <CardHeader className="pb-3 relative z-10">
                      <div className="flex items-start gap-3 mb-2">
                        <div className="relative flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 via-primary/10 to-accent/20 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-lg">
                          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary to-accent opacity-0 group-hover:opacity-20 transition-opacity duration-500" />
                          <Bot className="h-6 w-6 text-primary relative z-10" />
                        </div>
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <CardTitle className="text-base sm:text-lg font-bold line-clamp-2 break-words leading-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                            {agent.name}
                          </CardTitle>
                          <Badge
                            variant="outline"
                            className="mt-2 text-xs font-semibold border-primary/30 bg-primary/10 text-primary"
                          >
                            {aiModels.find((model) => model.id === agent.model_id)?.name || "Unknown Model"}
                          </Badge>
                        </div>
                      </div>
                      <CardDescription className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                        {agent.description || "No description provided"}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="pb-3 relative z-10">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/30 backdrop-blur-sm border border-border/50">
                          <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                            <Zap className="h-3.5 w-3.5 text-primary" />
                            Temperature
                          </span>
                          <span className="font-bold text-foreground">{agent.parameters?.temperature || 0.7}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/30 backdrop-blur-sm border border-border/50">
                          <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                            <TrendingUp className="h-3.5 w-3.5 text-accent" />
                            Max Tokens
                          </span>
                          <span className="font-bold text-foreground">{agent.max_tokens || 1000}</span>
                        </div>
                        {agent.tools && agent.tools.length > 0 && (
                          <div className="pt-2 border-t border-border/50">
                            <p className="text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-wide">
                              Tools ({agent.tools.length})
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {agent.tools.slice(0, 3).map((tool: any, idx: number) => (
                                <Badge
                                  key={idx}
                                  variant="secondary"
                                  className="text-xs px-2.5 py-0.5 bg-gradient-to-r from-secondary/20 to-accent/20 border border-secondary/30 hover:from-secondary/30 hover:to-accent/30 transition-all duration-300"
                                >
                                  {formatToolName(tool)}
                                </Badge>
                              ))}
                              {agent.tools.length > 3 && (
                                <Badge
                                  variant="secondary"
                                  className="text-xs px-2.5 py-0.5 bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30"
                                >
                                  +{agent.tools.length - 3} more
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>

                    <CardFooter className="flex justify-between gap-2 pt-3 border-t border-border/50 bg-muted/20 relative z-10">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleExecuteAgent(agent)}
                        className="flex-1 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 font-semibold"
                      >
                        <Play className="h-3.5 w-3.5 mr-1.5" />
                        Run
                      </Button>
                      <div className="flex gap-1.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 bg-card/50 backdrop-blur-sm border-border/50 hover:bg-primary/10 hover:border-primary/50 hover:text-primary transition-all duration-300"
                              onClick={() => handleEditAgent(agent)}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Edit agent</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 bg-card/50 backdrop-blur-sm border-border/50 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50 transition-all duration-300"
                              onClick={() => handleDeleteAgent(agent.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Delete agent</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </CardFooter>
                  </Card>
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        )}
      </div>

      {/* Create Agent Dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="max-w-full sm:max-w-[95vw] md:max-w-[800px] h-[90vh] sm:max-h-[85vh] p-0 flex flex-col gap-0 overflow-hidden">
          <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 border-b flex-shrink-0">
            <DialogTitle className="text-lg sm:text-xl">Create AI Agent</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Create a new AI agent with a specific purpose and personality.
            </DialogDescription>
          </DialogHeader>

          <div
            className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 overscroll-contain"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Agent Name</label>
                <Input
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="E.g., Customer Support Agent"
                  className="h-10 sm:h-11"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Description (Optional)</label>
                <Input
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="E.g., An agent that helps with customer inquiries"
                  className="h-10 sm:h-11"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">System Prompt</label>
                <Textarea
                  name="system_prompt"
                  value={formData.system_prompt}
                  onChange={handleInputChange}
                  placeholder="E.g., You are a helpful customer support agent for our company. You should be polite, informative, and concise."
                  className="min-h-[80px] sm:min-h-[100px] text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">AI Model</label>
                <Select value={formData.model_id} onValueChange={(value) => handleSelectChange("model_id", value)}>
                  <SelectTrigger className="h-10 sm:h-11">
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    {aiModels.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium">Temperature: {formData.temperature}</label>
                </div>
                <Slider
                  value={[formData.temperature]}
                  min={0}
                  max={1}
                  step={0.1}
                  onValueChange={(value) => handleSliderChange("temperature", value)}
                  className="py-2"
                />
                <p className="text-xs text-muted-foreground">
                  Lower values produce more predictable responses, higher values produce more creative ones.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium">Max Tokens: {formData.max_tokens}</label>
                </div>
                <Slider
                  value={[formData.max_tokens]}
                  min={100}
                  max={4000}
                  step={100}
                  onValueChange={(value) => handleSliderChange("max_tokens", value)}
                  className="py-2"
                />
                <p className="text-xs text-muted-foreground">Maximum number of tokens to generate in the response.</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Agent Tools</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div
                    className={`p-2.5 sm:p-3 border rounded-md cursor-pointer transition-all ${selectedTools.includes("web_search") ? "bg-primary/10 border-primary" : "hover:bg-muted/50"}`}
                    onClick={() => {
                      if (selectedTools.includes("web_search")) {
                        setSelectedTools(selectedTools.filter((t) => t !== "web_search"))
                      } else {
                        setSelectedTools([...selectedTools, "web_search"])
                      }
                    }}
                  >
                    <div className="font-medium text-sm">Web Search</div>
                    <div className="text-xs text-muted-foreground">Search the web for information</div>
                  </div>
                  <div
                    className={`p-2.5 sm:p-3 border rounded-md cursor-pointer transition-all ${selectedTools.includes("query_database") ? "bg-primary/10 border-primary" : "hover:bg-muted/50"}`}
                    onClick={() => {
                      if (selectedTools.includes("query_database")) {
                        setSelectedTools(selectedTools.filter((t) => t !== "query_database"))
                      } else {
                        setSelectedTools([...selectedTools, "query_database"])
                      }
                    }}
                  >
                    <div className="font-medium text-sm">Database Query</div>
                    <div className="text-xs text-muted-foreground">Query the database for information</div>
                  </div>
                  <div
                    className={`p-2.5 sm:p-3 border rounded-md cursor-pointer transition-all ${selectedTools.includes("analyze_data") ? "bg-primary/10 border-primary" : "hover:bg-muted/50"}`}
                    onClick={() => {
                      if (selectedTools.includes("analyze_data")) {
                        setSelectedTools(selectedTools.filter((t) => t !== "analyze_data"))
                      } else {
                        setSelectedTools([...selectedTools, "analyze_data"])
                      }
                    }}
                  >
                    <div className="font-medium text-sm">Data Analysis</div>
                    <div className="text-xs text-muted-foreground">Analyze data and generate insights</div>
                  </div>
                  <div
                    className={`p-2.5 sm:p-3 border rounded-md cursor-pointer transition-all ${selectedTools.includes("search_embeddings") ? "bg-primary/10 border-primary" : "hover:bg-muted/50"}`}
                    onClick={() => {
                      if (selectedTools.includes("search_embeddings")) {
                        setSelectedTools(selectedTools.filter((t) => t !== "search_embeddings"))
                      } else {
                        setSelectedTools([...selectedTools, "search_embeddings"])
                      }
                    }}
                  >
                    <div className="font-medium text-sm">Embeddings Search</div>
                    <div className="text-xs text-muted-foreground">Search vector embeddings for similar content</div>
                  </div>
                  <div
                    className={`p-2.5 sm:p-3 border rounded-md cursor-pointer transition-all ${selectedTools.includes("query_sui_blockchain") ? "bg-primary/10 border-primary" : "hover:bg-muted/50"}`}
                    onClick={() => {
                      if (selectedTools.includes("query_sui_blockchain")) {
                        setSelectedTools(selectedTools.filter((t) => t !== "query_sui_blockchain"))
                      } else {
                        setSelectedTools([...selectedTools, "query_sui_blockchain"])
                      }
                    }}
                  >
                    <div className="font-medium text-sm">Sui Blockchain</div>
                    <div className="text-xs text-muted-foreground">Query data from the Sui blockchain</div>
                  </div>
                  <div
                    className={`p-2.5 sm:p-3 border rounded-md cursor-pointer transition-all ${selectedTools.includes("analyze_nfts") ? "bg-primary/10 border-primary" : "hover:bg-muted/50"}`}
                    onClick={() => {
                      if (selectedTools.includes("analyze_nfts")) {
                        setSelectedTools(selectedTools.filter((t) => t !== "analyze_nfts"))
                      } else {
                        setSelectedTools([...selectedTools, "analyze_nfts"])
                      }
                    }}
                  >
                    <div className="font-medium text-sm">NFT Analysis</div>
                    <div className="text-xs text-muted-foreground">Analyze NFTs and provide insights</div>
                  </div>
                  <div
                    className={`p-2.5 sm:p-3 border rounded-md cursor-pointer transition-all ${selectedTools.includes("optimize_packaging") ? "bg-primary/10 border-primary" : "hover:bg-muted/50"}`}
                    onClick={() => {
                      if (selectedTools.includes("optimize_packaging")) {
                        setSelectedTools(selectedTools.filter((t) => t !== "optimize_packaging"))
                      } else {
                        setSelectedTools([...selectedTools, "optimize_packaging"])
                      }
                    }}
                  >
                    <div className="font-medium text-sm">Package Optimization</div>
                    <div className="text-xs text-muted-foreground">Optimize packaging for shipments</div>
                  </div>
                  <div
                    className={`p-2.5 sm:p-3 border rounded-md cursor-pointer transition-all ${selectedTools.includes("estimate_shipping_cost") ? "bg-primary/10 border-primary" : "hover:bg-muted/50"}`}
                    onClick={() => {
                      if (selectedTools.includes("estimate_shipping_cost")) {
                        setSelectedTools(selectedTools.filter((t) => t !== "estimate_shipping_cost"))
                      } else {
                        setSelectedTools([...selectedTools, "estimate_shipping_cost"])
                      }
                    }}
                  >
                    <div className="font-medium text-sm">Shipping Cost</div>
                    <div className="text-xs text-muted-foreground">Estimate shipping costs</div>
                  </div>
                  <div
                    className={`p-2.5 sm:p-3 border rounded-md cursor-pointer transition-all ${selectedTools.includes("generate_code") ? "bg-primary/10 border-primary" : "hover:bg-muted/50"}`}
                    onClick={() => {
                      if (selectedTools.includes("generate_code")) {
                        setSelectedTools(selectedTools.filter((t) => t !== "generate_code"))
                      } else {
                        setSelectedTools([...selectedTools, "generate_code"])
                      }
                    }}
                  >
                    <div className="font-medium text-sm">Code Generation</div>
                    <div className="text-xs text-muted-foreground">Generate code based on descriptions</div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Selected tools: {selectedTools.length > 0 ? selectedTools.join(", ") : "None"}
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="px-4 sm:px-6 py-3 sm:py-4 border-t flex-shrink-0 flex-row gap-2 sm:gap-3">
            <Button
              variant="outline"
              onClick={() => setIsCreating(false)}
              className="flex-1 sm:flex-initial h-10 sm:h-11"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateAgent}
              disabled={isLoading || !formData.name || !formData.system_prompt}
              className="flex-1 sm:flex-initial h-10 sm:h-11"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Agent"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Agent Dialog */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-lg sm:text-xl">Edit AI Agent</DialogTitle>
            <DialogDescription className="text-sm sm:text-base">
              Update your AI agent's settings and behavior.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 sm:space-y-5 py-4 overflow-y-auto flex-1 px-1">
            <div className="space-y-2 sm:space-y-2.5">
              <label className="text-sm font-medium leading-none">Agent Name</label>
              <Input
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="E.g., Customer Support Agent"
                className="h-11 text-base"
              />
            </div>
            <div className="space-y-2 sm:space-y-2.5">
              <label className="text-sm font-medium leading-none">Description (Optional)</label>
              <Input
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="E.g., An agent that helps with customer inquiries"
                className="h-11 text-base"
              />
            </div>
            <div className="space-y-2 sm:space-y-2.5">
              <label className="text-sm font-medium leading-none">System Prompt</label>
              <Textarea
                name="system_prompt"
                value={formData.system_prompt}
                onChange={handleInputChange}
                placeholder="E.g., You are a helpful customer support agent for our company. You should be polite, informative, and concise."
                className="min-h-[120px] text-base resize-none"
              />
            </div>
            <div className="space-y-2 sm:space-y-2.5">
              <label className="text-sm font-medium leading-none">AI Model</label>
              <Select value={formData.model_id} onValueChange={(value) => handleSelectChange("model_id", value)}>
                <SelectTrigger className="h-11 text-base">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {aiModels.map((model) => (
                    <SelectItem key={model.id} value={model.id} className="text-base">
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3 sm:space-y-3.5">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium leading-none">Temperature</label>
                <span className="text-sm font-semibold tabular-nums">{formData.temperature.toFixed(1)}</span>
              </div>
              <div className="py-2">
                <Slider
                  value={[formData.temperature]}
                  min={0}
                  max={1}
                  step={0.1}
                  onValueChange={(value) => handleSliderChange("temperature", value)}
                  className="cursor-pointer [&_[role=slider]]:h-5 [&_[role=slider]]:w-5"
                />
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Lower values produce more predictable responses, higher values produce more creative ones.
              </p>
            </div>
            <div className="space-y-3 sm:space-y-3.5">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium leading-none">Max Tokens</label>
                <span className="text-sm font-semibold tabular-nums">{formData.max_tokens}</span>
              </div>
              <div className="py-2">
                <Slider
                  value={[formData.max_tokens]}
                  min={100}
                  max={4000}
                  step={100}
                  onValueChange={(value) => handleSliderChange("max_tokens", value)}
                  className="cursor-pointer [&_[role=slider]]:h-5 [&_[role=slider]]:w-5"
                />
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Maximum number of tokens to generate in the response.
              </p>
            </div>
            <div className="space-y-3 sm:space-y-3.5">
              <label className="text-sm font-medium leading-none">Agent Tools</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  className={`min-h-[88px] p-4 border-2 rounded-lg cursor-pointer transition-all active:scale-[0.98] ${
                    selectedTools.includes("web_search")
                      ? "bg-primary/10 border-primary shadow-sm"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => {
                    if (selectedTools.includes("web_search")) {
                      setSelectedTools(selectedTools.filter((t) => t !== "web_search"))
                    } else {
                      setSelectedTools([...selectedTools, "web_search"])
                    }
                  }}
                >
                  <div className="font-medium text-base mb-1.5">Web Search</div>
                  <div className="text-sm text-muted-foreground leading-relaxed">Web Search</div>
                </div>
                <div
                  className={`min-h-[88px] p-4 border-2 rounded-lg cursor-pointer transition-all active:scale-[0.98] ${
                    selectedTools.includes("query_database")
                      ? "bg-primary/10 border-primary shadow-sm"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => {
                    if (selectedTools.includes("query_database")) {
                      setSelectedTools(selectedTools.filter((t) => t !== "query_database"))
                    } else {
                      setSelectedTools([...selectedTools, "query_database"])
                    }
                  }}
                >
                  <div className="font-medium text-base mb-1.5">Database Query</div>
                  <div className="text-sm text-muted-foreground leading-relaxed">
                    Query the database for information
                  </div>
                </div>
                <div
                  className={`min-h-[88px] p-4 border-2 rounded-lg cursor-pointer transition-all active:scale-[0.98] ${
                    selectedTools.includes("analyze_data")
                      ? "bg-primary/10 border-primary shadow-sm"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => {
                    if (selectedTools.includes("analyze_data")) {
                      setSelectedTools(selectedTools.filter((t) => t !== "analyze_data"))
                    } else {
                      setSelectedTools([...selectedTools, "analyze_data"])
                    }
                  }}
                >
                  <div className="font-medium text-base mb-1.5">Data Analysis</div>
                  <div className="text-sm text-muted-foreground leading-relaxed">
                    Analyze data and generate insights
                  </div>
                </div>
                <div
                  className={`min-h-[88px] p-4 border-2 rounded-lg cursor-pointer transition-all active:scale-[0.98] ${
                    selectedTools.includes("search_embeddings")
                      ? "bg-primary/10 border-primary shadow-sm"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => {
                    if (selectedTools.includes("search_embeddings")) {
                      setSelectedTools(selectedTools.filter((t) => t !== "search_embeddings"))
                    } else {
                      setSelectedTools([...selectedTools, "search_embeddings"])
                    }
                  }}
                >
                  <div className="font-medium text-base mb-1.5">Embeddings Search</div>
                  <div className="text-sm text-muted-foreground leading-relaxed">
                    Search vector embeddings for similar content
                  </div>
                </div>
                <div
                  className={`min-h-[88px] p-4 border-2 rounded-lg cursor-pointer transition-all active:scale-[0.98] ${
                    selectedTools.includes("query_sui_blockchain")
                      ? "bg-primary/10 border-primary shadow-sm"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => {
                    if (selectedTools.includes("query_sui_blockchain")) {
                      setSelectedTools(selectedTools.filter((t) => t !== "query_sui_blockchain"))
                    } else {
                      setSelectedTools([...selectedTools, "query_sui_blockchain"])
                    }
                  }}
                >
                  <div className="font-medium text-base mb-1.5">Sui Blockchain</div>
                  <div className="text-sm text-muted-foreground leading-relaxed">
                    Query data from the Sui blockchain
                  </div>
                </div>
                <div
                  className={`min-h-[88px] p-4 border-2 rounded-lg cursor-pointer transition-all active:scale-[0.98] ${
                    selectedTools.includes("analyze_nfts")
                      ? "bg-primary/10 border-primary shadow-sm"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => {
                    if (selectedTools.includes("analyze_nfts")) {
                      setSelectedTools(selectedTools.filter((t) => t !== "analyze_nfts"))
                    } else {
                      setSelectedTools([...selectedTools, "analyze_nfts"])
                    }
                  }}
                >
                  <div className="font-medium text-base mb-1.5">NFT Analysis</div>
                  <div className="text-sm text-muted-foreground leading-relaxed">Analyze NFTs and provide insights</div>
                </div>
                <div
                  className={`min-h-[88px] p-4 border-2 rounded-lg cursor-pointer transition-all active:scale-[0.98] ${
                    selectedTools.includes("optimize_packaging")
                      ? "bg-primary/10 border-primary shadow-sm"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => {
                    if (selectedTools.includes("optimize_packaging")) {
                      setSelectedTools(selectedTools.filter((t) => t !== "optimize_packaging"))
                    } else {
                      setSelectedTools([...selectedTools, "optimize_packaging"])
                    }
                  }}
                >
                  <div className="font-medium text-base mb-1.5">Package Optimization</div>
                  <div className="text-sm text-muted-foreground leading-relaxed">Optimize packaging for shipments</div>
                </div>
                <div
                  className={`min-h-[88px] p-4 border-2 rounded-lg cursor-pointer transition-all active:scale-[0.98] ${
                    selectedTools.includes("estimate_shipping_cost")
                      ? "bg-primary/10 border-primary shadow-sm"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => {
                    if (selectedTools.includes("estimate_shipping_cost")) {
                      setSelectedTools(selectedTools.filter((t) => t !== "estimate_shipping_cost"))
                    } else {
                      setSelectedTools([...selectedTools, "estimate_shipping_cost"])
                    }
                  }}
                >
                  <div className="font-medium text-base mb-1.5">Shipping Cost</div>
                  <div className="text-sm text-muted-foreground leading-relaxed">Estimate shipping costs</div>
                </div>
                <div
                  className={`min-h-[88px] p-4 border-2 rounded-lg cursor-pointer transition-all active:scale-[0.98] ${
                    selectedTools.includes("generate_code")
                      ? "bg-primary/10 border-primary shadow-sm"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => {
                    if (selectedTools.includes("generate_code")) {
                      setSelectedTools(selectedTools.filter((t) => t !== "generate_code"))
                    } else {
                      setSelectedTools([...selectedTools, "generate_code"])
                    }
                  }}
                >
                  <div className="font-medium text-base mb-1.5">Code Generation</div>
                  <div className="text-sm text-muted-foreground leading-relaxed">
                    Generate code based on descriptions
                  </div>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Selected tools: {selectedTools.length > 0 ? selectedTools.join(", ") : "None"}
              </p>
            </div>
          </div>
          <DialogFooter className="flex-shrink-0 gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsEditing(false)}
              className="h-11 text-base flex-1 sm:flex-none"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateAgent}
              disabled={isLoading || !formData.name || !formData.system_prompt}
              className="h-11 text-base flex-1 sm:flex-none"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Agent"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isExecuting} onOpenChange={setIsExecuting}>
        <DialogContent className="max-w-[95vw] sm:max-w-[800px] max-h-[95vh] flex flex-col p-0 gap-0">
          <div className="flex flex-col h-full max-h-[95vh]">
            <DialogHeader className="flex-shrink-0 px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <DialogTitle className="text-base sm:text-lg truncate">{selectedAgent?.name}</DialogTitle>
                  <DialogDescription className="text-xs sm:text-sm">
                    {executionResult ? "Execution completed successfully" : "Configure and run your AI agent"}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-4 sm:px-6 min-h-0">
              {executionResult ? (
                <div className="py-4">
                  <AgentExecutionReport
                    result={executionResult}
                    agentName={selectedAgent?.name || "Unknown Agent"}
                    prompt={executionPrompt}
                    agentData={{
                      id: selectedAgent?.id || "",
                      model:
                        aiModels.find((m) => m.id === selectedAgent?.model_id)?.name ||
                        selectedAgent?.model ||
                        "Unknown Model",
                      model_id: selectedAgent?.model_id || "",
                      created_at: selectedAgent?.created_at || "",
                    }}
                  />
                </div>
              ) : (
                <div className="space-y-4 py-4">
                  {/* Prompt Input */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Your Prompt</label>
                    <Textarea
                      value={executionPrompt}
                      onChange={(e) => setExecutionPrompt(e.target.value)}
                      placeholder="Enter your prompt here..."
                      className="min-h-[100px] text-base sm:text-sm resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Asset Context (Optional)</label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Select assets to provide additional context for the agent
                    </p>
                    {assetsLoading ? (
                      <div className="border rounded-md p-6 text-center">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Loading assets...</p>
                      </div>
                    ) : assetsError ? (
                      <div className="border border-destructive/50 rounded-md p-6 text-center bg-destructive/5">
                        <p className="text-sm text-destructive mb-2">Failed to load assets</p>
                        <p className="text-xs text-muted-foreground">{assetsError}</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3 bg-transparent"
                          onClick={() => {
                            setAssetsLoading(true)
                            setAssetsError(null)
                            getAssets().then((result) => {
                              if (result.success && result.data) {
                                setAvailableAssets(result.data)
                                setAssetsError(null)
                              } else {
                                setAssetsError(result.error || "Failed to load assets")
                              }
                              setAssetsLoading(false)
                            })
                          }}
                        >
                          Retry
                        </Button>
                      </div>
                    ) : availableAssets.length > 0 ? (
                      <>
                        <div className="border rounded-md">
                          <ScrollArea className="h-[200px] sm:h-48">
                            <div className="space-y-1 p-3">
                              {availableAssets.map((asset) => {
                                const isIoTSensor = asset.metadata?.is_iot_sensor === true
                                return (
                                  <div
                                    key={asset.id}
                                    className="flex items-start space-x-3 p-3 rounded-lg hover:bg-muted/50 transition-colors touch-manipulation active:bg-muted"
                                  >
                                    <input
                                      type="checkbox"
                                      id={`agent-exec-asset-${asset.id}`}
                                      checked={selectedAssets.includes(asset.id)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedAssets([...selectedAssets, asset.id])
                                        } else {
                                          setSelectedAssets(selectedAssets.filter((id) => id !== asset.id))
                                        }
                                      }}
                                      className="rounded w-5 h-5 sm:w-4 sm:h-4 mt-0.5 flex-shrink-0"
                                    />
                                    <label
                                      htmlFor={`agent-exec-asset-${asset.id}`}
                                      className="flex-1 cursor-pointer min-w-0"
                                    >
                                      <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium leading-tight">{asset.name}</p>
                                        {isIoTSensor && (
                                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20">
                                            IoT
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        {asset.asset_type} {asset.category && `• ${asset.category}`}
                                        {isIoTSensor && asset.metadata?.temperature && (
                                          <> • {asset.metadata.temperature}°C</>
                                        )}
                                        {isIoTSensor && asset.metadata?.battery_level && (
                                          <> • {asset.metadata.battery_level}% battery</>
                                        )}
                                      </p>
                                    </label>
                                  </div>
                                )
                              })}
                            </div>
                          </ScrollArea>
                        </div>
                        {selectedAssets.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-2">
                            {selectedAssets.length} asset{selectedAssets.length !== 1 ? "s" : ""} selected for context
                          </p>
                        )}
                      </>
                    ) : (
                      <div className="border rounded-md p-6 text-center">
                        <p className="text-sm text-muted-foreground">
                          No assets available. Create assets in the Asset Intelligence section to use them as context.
                        </p>
                      </div>
                    )}
                  </div>

                  <DataSourceSelector
                    selectedTables={selectedTables}
                    selectedEndpoints={selectedEndpoints}
                    includeLearningData={includeLearningData}
                    onTablesChange={setSelectedTables}
                    onEndpointsChange={setSelectedEndpoints}
                    onLearningDataChange={setIncludeLearningData}
                    mode="input"
                  />

                  <DataStreamSelector
                    selectedStreams={selectedDataStreams}
                    onStreamsChange={setSelectedDataStreams}
                    mode="input"
                  />

                  <div className="flex items-center space-x-2 p-3 border rounded-lg bg-muted/30">
                    <Checkbox
                      id="save-to-learning"
                      checked={saveToLearning}
                      onCheckedChange={(checked) => setSaveToLearning(checked as boolean)}
                    />
                    <Label htmlFor="save-to-learning" className="text-sm font-medium cursor-pointer flex-1">
                      Save to Learning Layer
                      <p className="text-xs text-muted-foreground font-normal mt-1">
                        Store this execution result to improve future AI responses through continuous learning
                      </p>
                    </Label>
                  </div>

                  {/* Execution Result */}
                  {executionResult && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Agent Response</label>
                      <div className="bg-muted p-4 rounded-md overflow-auto max-h-[300px]">
                        <p className="whitespace-pre-wrap text-sm">{executionResult.finalResponse}</p>
                      </div>
                      {executionResult.toolCalls && executionResult.toolCalls.length > 0 && (
                        <div className="mt-4">
                          <label className="text-sm font-medium">Tools Used</label>
                          <div className="bg-muted p-4 rounded-md overflow-auto max-h-[200px] mt-2">
                            <ul className="space-y-2">
                              {executionResult.toolCalls.map((toolCall: any, index: number) => (
                                <li key={index} className="text-sm">
                                  <span className="font-medium">{toolCall.tool}:</span>{" "}
                                  <code className="text-xs">{JSON.stringify(toolCall.params)}</code>
                                  <div className="mt-1 text-xs">
                                    Result: <code>{JSON.stringify(toolCall.result)}</code>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-2">
                        Execution time: {(executionResult.elapsedMs / 1000).toFixed(2)}s | Tokens used:{" "}
                        {executionResult.tokens.total}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0 px-4 sm:px-6 py-3 sm:py-4 border-t bg-muted/30">
              <Button
                variant="outline"
                onClick={() => {
                  setIsExecuting(false)
                  setSelectedAssets([])
                  setSelectedTables([])
                  setSelectedEndpoints([])
                  setIncludeLearningData(false)
                  setSelectedDataStreams([])
                  setSaveToLearning(false)
                }}
                className="w-full sm:w-auto"
              >
                Close
              </Button>
              {!executionResult && (
                <Button
                  onClick={runAgent}
                  disabled={isLoading || !executionPrompt.trim()}
                  className="w-full sm:w-auto shadow-sm"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Run Agent
                    </>
                  )}
                </Button>
              )}
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Template Selector Dialog */}
      <Dialog open={isSelectingTemplate} onOpenChange={setIsSelectingTemplate}>
        <DialogContent className="sm:max-w-[900px]">
          <AgentTemplateSelector onSelect={handleTemplateSelect} onCancel={() => setIsSelectingTemplate(false)} />
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
