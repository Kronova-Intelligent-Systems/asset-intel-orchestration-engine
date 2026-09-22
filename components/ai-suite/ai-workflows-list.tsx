"use client"

import { useState } from "react"

import type React from "react"
import { useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
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
import { AIWorkflowExample } from "./ai-workflow-example"
import { Play, Pause, Settings, Plus, GitBranch, Clock, CheckCircle, Edit, Trash2, Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import {
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  executeWorkflow,
  saveWorkflowToLearningLayer,
} from "@/app/actions/workflow-actions"
import { getAssets } from "@/app/actions/asset-intelligence-actions"
import type { WorkflowStep } from "@/lib/schemas/ai"
import { workflowTemplates, getCategories, searchTemplates } from "@/lib/workflows/workflow-templates"
import { ScrollArea } from "@/components/ui/scroll-area"
import { WorkflowExecutionReport } from "./workflow-execution-report"
import { DataSourceSelector } from "@/components/asset-intelligence/data-source-selector"
import { DataStreamSelector } from "@/components/ai-suite/data-stream-selector"

interface AIWorkflowsListProps {
  workflows: any[]
  user: any
}

export function AIWorkflowsList({ workflows, user }: AIWorkflowsListProps) {
  const [activeTab, setActiveTab] = useState("my-workflows")
  const [isCreating, setIsCreating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [selectedWorkflow, setSelectedWorkflow] = useState<any>(null)
  const [workflowParameters, setWorkflowParameters] = useState<Record<string, any>>({})
  const [executionResult, setExecutionResult] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSavingToLearning, setIsSavingToLearning] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null)
  const [templateSearch, setTemplateSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedAssets, setSelectedAssets] = useState<string[]>([])
  const [availableAssets, setAvailableAssets] = useState<any[]>([])
  const [selectedTables, setSelectedTables] = useState<string[]>([])
  const [selectedEndpoints, setSelectedEndpoints] = useState<string[]>([])
  const [includeLearningData, setIncludeLearningData] = useState(false)
  const [selectedDataStreams, setSelectedDataStreams] = useState<string[]>([])
  const [saveToLearning, setSaveToLearning] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    steps: [] as WorkflowStep[],
    trigger_type: "",
    trigger_config: {},
    ai_model: "claude-3-5-sonnet-20241022", // Added ai_model to form state
    is_active: true,
  })
  const { toast } = useToast()

  useEffect(() => {
    const loadAssets = async () => {
      try {
        const result = await getAssets()
        if (result.success && result.data) {
          setAvailableAssets(result.data)
        }
      } catch (error) {
        console.error("Failed to load assets:", error)
      }
    }
    loadAssets()
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      steps: [],
      trigger_type: "",
      trigger_config: {},
      ai_model: "claude-3-5-sonnet-20241022", // Reset ai_model to default
      is_active: true,
    })
  }

  const handleCreateWorkflow = async () => {
    setIsLoading(true)
    try {
      const result = await createWorkflow({
        ...formData,
        user_id: user.id,
      })

      if (result.success) {
        toast({
          title: "Workflow created",
          description: "Your AI workflow has been created successfully.",
        })
        setIsCreating(false)
        setSelectedTemplate(null)
        setSelectedAssets([])
        resetForm()
        window.location.reload()
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to create workflow",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error creating workflow:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditWorkflow = (workflow: any) => {
    setSelectedWorkflow(workflow)
    setFormData({
      name: workflow.name,
      description: workflow.description || "",
      steps: workflow.steps || [],
      trigger_type: workflow.trigger_type || "",
      trigger_config: workflow.trigger_config || {},
      ai_model: workflow.ai_model || "claude-3-5-sonnet-20241022", // Ensure a default is set if not present
      is_active: workflow.is_active,
    })
    setIsEditing(true)
  }

  const handleUpdateWorkflow = async () => {
    if (!selectedWorkflow) return

    setIsLoading(true)
    try {
      const result = await updateWorkflow({
        id: selectedWorkflow.id,
        ...formData,
        user_id: user.id,
      })

      if (result.success) {
        toast({
          title: "Workflow updated",
          description: "Your AI workflow has been updated successfully.",
        })
        setIsEditing(false)
        setSelectedWorkflow(null)
        setSelectedAssets([])
        resetForm()
        window.location.reload()
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to update workflow",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error updating workflow:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteWorkflow = async (workflowId: string) => {
    if (!confirm("Are you sure you want to delete this workflow?")) return

    try {
      const result = await deleteWorkflow(workflowId)

      if (result.success) {
        toast({
          title: "Workflow deleted",
          description: "Your AI workflow has been deleted successfully.",
        })
        window.location.reload()
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to delete workflow",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error deleting workflow:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleExecuteWorkflow = (workflow: any) => {
    setSelectedWorkflow(workflow)
    setWorkflowParameters({})
    setExecutionResult(null)
    setSelectedAssets([])
    setSelectedTables([])
    setSelectedEndpoints([])
    setIncludeLearningData(false)
    setSelectedDataStreams([])
    setSaveToLearning(false)
    setIsExecuting(true)
  }

  const runWorkflow = async () => {
    if (!selectedWorkflow) return

    setIsLoading(true)
    setExecutionResult(null)

    try {
      const input: any = { ...workflowParameters }

      if (selectedAssets.length > 0) {
        input.asset_ids = selectedAssets
      }
      if (selectedTables.length > 0) {
        input.tables = selectedTables
      }
      if (selectedEndpoints.length > 0) {
        input.endpoints = selectedEndpoints
      }
      if (includeLearningData) {
        input.includeLearningData = true
      }
      if (selectedDataStreams.length > 0) {
        input.dataStreamIds = selectedDataStreams
      }
      // Ensure ai_model is passed if available in the workflow
      if (selectedWorkflow.ai_model) {
        input.ai_model = selectedWorkflow.ai_model
      }

      const result = await executeWorkflow({
        workflowId: selectedWorkflow.id,
        input,
      })

      if (result.success) {
        setExecutionResult(result.data)

        if (saveToLearning && result.data) {
          const learningResult = await saveWorkflowToLearningLayer({
            name: `Workflow Execution: ${selectedWorkflow.name}`,
            description: `Execution of workflow ${selectedWorkflow.name}`,
            executionType: "workflow",
            executionId: selectedWorkflow.id,
            executionName: selectedWorkflow.name,
            assetIds: selectedAssets.length > 0 ? selectedAssets : undefined,
            executionInput: {
              parameters: workflowParameters,
              assetIds: selectedAssets,
              tables: selectedTables,
              endpoints: selectedEndpoints,
              dataStreams: selectedDataStreams,
              ai_model: selectedWorkflow.ai_model, // Include AI model in input for learning layer
            },
            executionOutput: result.data,
            tags: ["workflow", selectedWorkflow.name, ...selectedTables, ...selectedEndpoints],
          })

          if (learningResult.success) {
            toast({
              title: "Saved to Learning Layer",
              description: "This execution has been saved for future AI optimization.",
            })
          } else {
            toast({
              title: "Error",
              description: learningResult.error || "Failed to save to learning layer",
              variant: "destructive",
            })
          }
        }
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to execute workflow",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error executing workflow:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const saveToLearningLayer = async () => {
    if (!executionResult || !selectedWorkflow) return

    setIsSavingToLearning(true)

    try {
      // Import the action dynamically to avoid circular dependencies
      // const { saveWorkflowToLearningLayer } = await import("@/app/actions/workflow-actions") // No longer needed as it's imported at the top

      const result = await saveWorkflowToLearningLayer({
        workflowId: selectedWorkflow.id,
        workflowName: selectedWorkflow.name,
        executionResult: executionResult,
        userId: user.id,
        // Include AI model from selected workflow for learning layer context
        ai_model: selectedWorkflow.ai_model,
      })

      if (result.success) {
        toast({
          title: "Saved to Learning Layer",
          description: "Workflow execution has been saved to the learning layer for future reference.",
        })
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to save to learning layer",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error saving to learning layer:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred while saving to learning layer.",
        variant: "destructive",
      })
    } finally {
      setIsSavingToLearning(false)
    }
  }

  const handleUseTemplate = (template: any) => {
    setFormData({
      name: template.name,
      description: template.description,
      steps: template.steps,
      trigger_type: template.trigger_type,
      trigger_config: template.trigger_config,
      ai_model: template.ai_model || "claude-3-5-sonnet-20241022", // Use template's AI model or default
      is_active: true,
    })
    setSelectedTemplate(template)
    setIsCreating(true)
    toast({
      title: "Template loaded",
      description: `Template "${template.name}" has been loaded. You can customize it before creating.`,
    })
  }

  const filteredTemplates = () => {
    let templates = workflowTemplates

    if (selectedCategory !== "all") {
      templates = templates.filter((template) => template.category === selectedCategory)
    }

    if (templateSearch) {
      templates = searchTemplates(templateSearch)
    }

    return templates
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-primary via-blue-600 to-cyan-600 bg-clip-text text-transparent">
              AI Workflows
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Orchestrate complex automation with intelligent workflow templates
            </p>
          </div>
          <Button
            className="w-full sm:w-auto shadow-lg hover:shadow-xl transition-all"
            onClick={() => setIsCreating(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Workflow
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <Card className="enterprise-card relative overflow-hidden group hover:shadow-2xl transition-all duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity duration-500 pointer-events-none" />
            <CardContent className="p-4 relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="dashboard-metric-label mb-1">Total Workflows</p>
                  <p className="dashboard-metric-value">{workflows.length}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                  <GitBranch className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="enterprise-card relative overflow-hidden group hover:shadow-2xl transition-all duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 via-transparent to-emerald-500/10 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity duration-500 pointer-events-none" />
            <CardContent className="p-4 relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="dashboard-metric-label mb-1">Active</p>
                  <p className="dashboard-metric-value text-green-600 dark:text-green-400">
                    {workflows.filter((w) => w.is_active).length}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                  <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="enterprise-card relative overflow-hidden group hover:shadow-2xl transition-all duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-cyan-500/10 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity duration-500 pointer-events-none" />
            <CardContent className="p-4 relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="dashboard-metric-label mb-1">Executions</p>
                  <p className="dashboard-metric-value">
                    {workflows.reduce((sum, w) => sum + (w.execution_count || 0), 0)}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                  <Play className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="enterprise-card relative overflow-hidden group hover:shadow-2xl transition-all duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-violet-500/10 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity duration-500 pointer-events-none" />
            <CardContent className="p-4 relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="dashboard-metric-label mb-1">Templates</p>
                  <p className="dashboard-metric-value">{workflowTemplates.length}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                  <Settings className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="w-full overflow-x-auto pb-2">
          <TabsList className="w-full sm:w-auto inline-flex h-auto p-1 bg-muted/50 rounded-lg backdrop-blur-sm">
            <TabsTrigger
              value="my-workflows"
              className="text-xs sm:text-sm px-3 sm:px-4 py-2.5 whitespace-nowrap data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
            >
              <GitBranch className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
              <span>My Workflows</span>
            </TabsTrigger>
            <TabsTrigger
              value="templates"
              className="text-xs sm:text-sm px-3 sm:px-4 py-2.5 whitespace-nowrap data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
            >
              <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
              <span>Templates</span>
            </TabsTrigger>
            <TabsTrigger
              value="examples"
              className="text-xs sm:text-sm px-3 sm:px-4 py-2.5 whitespace-nowrap data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
            >
              <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
              <span>Examples</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="my-workflows" className="mt-6">
          {workflows.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <GitBranch className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No workflows yet</h3>
                <p className="text-muted-foreground mb-4 max-w-md">
                  Create your first AI workflow to automate business processes and save time.
                </p>
                <Button onClick={() => setIsCreating(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Workflow
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:gap-5">
              {workflows.map((workflow) => (
                <Card
                  key={workflow.id}
                  className="enterprise-card group relative overflow-hidden"
                >
                  <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity duration-500 pointer-events-none">
                    <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary/20 via-transparent to-accent/20" />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity duration-500 pointer-events-none" />

                  <CardHeader className="pb-3 relative z-10">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="relative flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 via-blue-500/10 to-cyan-500/20 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-lg">
                          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 opacity-0 group-hover:opacity-20 transition-opacity duration-500" />
                          <GitBranch className="h-6 w-6 text-blue-600 dark:text-blue-400 relative z-10" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg sm:text-xl break-words leading-tight font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                            {workflow.name}
                          </CardTitle>
                          <CardDescription className="mt-1 line-clamp-2 leading-relaxed break-words text-muted-foreground">
                            {workflow.description}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge
                          variant={workflow.is_active ? "default" : "secondary"}
                          className="shadow-sm border-primary/30"
                        >
                          {workflow.is_active ? (
                            <>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Active
                            </>
                          ) : (
                            <>
                              <Pause className="h-3 w-3 mr-1" />
                              Inactive
                            </>
                          )}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 relative z-10">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4 p-4 bg-muted/30 rounded-lg">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Steps</p>
                        <p className="text-lg font-semibold flex items-center gap-1">
                          <GitBranch className="h-4 w-4 text-primary" />
                          {workflow.steps?.length || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Executions</p>
                        <p className="text-lg font-semibold flex items-center gap-1">
                          <Play className="h-4 w-4 text-blue-600" />
                          {workflow.execution_count || 0}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-muted-foreground mb-1">Created</p>
                        <p className="text-sm font-medium flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(workflow.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between gap-2 pt-3 border-t relative z-10">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleExecuteWorkflow(workflow)}
                      className="flex-1 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Run
                    </Button>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 bg-transparent"
                        onClick={() => handleEditWorkflow(workflow)}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50 bg-transparent"
                        onClick={() => handleDeleteWorkflow(workflow.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates" className="mt-6">
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search templates..."
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  className="w-full"
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {getCategories().map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filteredTemplates().map((template) => (
                <Card
                  key={template.id}
                  className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-2 hover:border-primary/50"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-3">
                      <div className="text-3xl flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                        {template.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base sm:text-lg line-clamp-2 leading-tight">
                          {template.name}
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge variant="outline" className="text-xs shadow-sm">
                            {template.category}
                          </Badge>
                          <Badge
                            variant={
                              template.difficulty === "beginner"
                                ? "default"
                                : template.difficulty === "intermediate"
                                  ? "secondary"
                                  : "destructive"
                            }
                            className="text-xs shadow-sm"
                          >
                            {template.difficulty}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">{template.description}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <GitBranch className="h-3 w-3" />
                      <span>{template.steps.length} steps</span>
                      <span>•</span>
                      <Clock className="h-3 w-3" />
                      <span>{template.estimated_time}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {template.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {template.tags.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{template.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-2 shadow-sm hover:shadow-md transition-shadow bg-transparent"
                      onClick={() => handleUseTemplate(template)}
                    >
                      <Plus className="h-3 w-3 mr-2" />
                      Use Template
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredTemplates().length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No templates found matching your criteria.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="examples" className="mt-6">
          <AIWorkflowExample />
        </TabsContent>
      </Tabs>

      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="max-w-[95vw] sm:max-w-[600px] max-h-[95vh] sm:max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">
              {selectedTemplate ? `Create Workflow from Template: ${selectedTemplate.name}` : "Create AI Workflow"}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {selectedTemplate
                ? "Customize the template settings below before creating your workflow."
                : "Create a new AI workflow to automate your business processes."}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(95vh-200px)] sm:max-h-[60vh]">
            <div className="space-y-4 py-4 pr-4">
              {selectedTemplate && (
                <div className="bg-muted p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{selectedTemplate.icon}</span>
                    <span className="font-medium">{selectedTemplate.category}</span>
                    <Badge variant="outline">{selectedTemplate.difficulty}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{selectedTemplate.description}</p>
                  <div className="text-xs text-muted-foreground">
                    {selectedTemplate.steps.length} steps • {selectedTemplate.estimated_time}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Workflow Name</label>
                <Input
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="E.g., Customer Onboarding Process"
                  className="h-11 sm:h-10"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description (Optional)</label>
                <Textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Describe what this workflow does..."
                  className="min-h-[80px] text-base sm:text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Trigger Type</label>
                <Select
                  value={formData.trigger_type}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, trigger_type: value }))}
                >
                  <SelectTrigger className="h-11 sm:h-10">
                    <SelectValue placeholder="Select trigger type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="schedule">Scheduled</SelectItem>
                    <SelectItem value="webhook">Webhook</SelectItem>
                    <SelectItem value="event">Event-based</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">AI Model</label>
                <Select
                  value={formData.ai_model}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, ai_model: value }))}
                >
                  <SelectTrigger className="h-11 sm:h-10">
                    <SelectValue placeholder="Select AI model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</SelectItem>
                    <SelectItem value="claude-3-opus-20240229">Claude 3 Opus</SelectItem>
                    <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                    <SelectItem value="gpt-4">GPT-4</SelectItem>
                    <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                    <SelectItem value="gemini-pro">Gemini Pro</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Choose which AI model will execute this workflow</p>
              </div>

              {availableAssets.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Asset Context (Optional)</label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Select assets to provide context for this workflow
                  </p>
                  <ScrollArea className="h-48 border rounded-md p-3">
                    <div className="space-y-2">
                      {availableAssets.map((asset) => (
                        <div
                          key={asset.id}
                          className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50 transition-colors touch-manipulation"
                        >
                          <input
                            type="checkbox"
                            id={`workflow-asset-${asset.id}`}
                            checked={selectedAssets.includes(asset.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedAssets([...selectedAssets, asset.id])
                              } else {
                                setSelectedAssets(selectedAssets.filter((id) => id !== asset.id))
                              }
                            }}
                            className="rounded w-5 h-5 sm:w-4 sm:h-4"
                          />
                          <label htmlFor={`workflow-asset-${asset.id}`} className="flex-1 cursor-pointer">
                            <div>
                              <p className="text-sm font-medium">{asset.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {asset.asset_type} {asset.category && `• ${asset.category}`}
                              </p>
                            </div>
                          </label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  {selectedAssets.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {selectedAssets.length} asset{selectedAssets.length !== 1 ? "s" : ""} selected
                    </p>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setIsCreating(false)
                setSelectedTemplate(null)
                setSelectedAssets([])
              }}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button onClick={handleCreateWorkflow} disabled={isLoading || !formData.name} className="w-full sm:w-auto">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Workflow"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-[95vw] sm:max-w-[600px] max-h-[95vh] sm:max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Edit AI Workflow</DialogTitle>
            <DialogDescription className="text-sm">
              Update your AI workflow settings and configuration.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(95vh-200px)] sm:max-h-[60vh]">
            <div className="space-y-4 py-4 pr-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Workflow Name</label>
                <Input
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="E.g., Customer Onboarding Process"
                  className="h-11 sm:h-10"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description (Optional)</label>
                <Textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Describe what this workflow does..."
                  className="min-h-[80px] text-base sm:text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Trigger Type</label>
                <Select
                  value={formData.trigger_type}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, trigger_type: value }))}
                >
                  <SelectTrigger className="h-11 sm:h-10">
                    <SelectValue placeholder="Select trigger type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="schedule">Scheduled</SelectItem>
                    <SelectItem value="webhook">Webhook</SelectItem>
                    <SelectItem value="event">Event-based</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* AI Model selector for editing */}
              <div className="space-y-2">
                <label className="text-sm font-medium">AI Model</label>
                <Select
                  value={formData.ai_model}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, ai_model: value }))}
                >
                  <SelectTrigger className="h-11 sm:h-10">
                    <SelectValue placeholder="Select AI model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</SelectItem>
                    <SelectItem value="claude-3-opus-20240229">Claude 3 Opus</SelectItem>
                    <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                    <SelectItem value="gpt-4">GPT-4</SelectItem>
                    <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                    <SelectItem value="gemini-pro">Gemini Pro</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Choose which AI model will execute this workflow</p>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsEditing(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleUpdateWorkflow} disabled={isLoading || !formData.name} className="w-full sm:w-auto">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Workflow"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isExecuting} onOpenChange={setIsExecuting}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-[900px] max-h-[95vh] sm:max-h-[90vh] overflow-hidden p-4 sm:p-6">
          <DialogHeader className="space-y-2 pr-2">
            <DialogTitle className="text-sm sm:text-base lg:text-lg break-words leading-tight pr-6">
              Execute Workflow: {selectedWorkflow?.name}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm break-words leading-relaxed pr-2">
              {executionResult
                ? "Workflow execution completed"
                : "Configure workflow parameters and context, then run your workflow."}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(95vh-200px)] sm:max-h-[60vh] overflow-x-hidden">
            <div className="space-y-4 py-4 pr-2 sm:pr-4">
              {!executionResult && (
                <>
                  <div className="space-y-2 max-w-full">
                    <label className="text-sm sm:text-base font-medium">Workflow Parameters</label>
                    <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                      Configure the parameters for this workflow execution
                    </p>
                    <div className="space-y-3 border rounded-lg p-2.5 sm:p-4 bg-muted/30 max-w-full">
                      {/* Common workflow parameters */}
                      <div className="space-y-2 max-w-full">
                        <label className="text-xs font-medium text-muted-foreground">Target (Optional)</label>
                        <Input
                          placeholder="e.g., customer_data, inventory_items"
                          value={workflowParameters.target || ""}
                          onChange={(e) => setWorkflowParameters({ ...workflowParameters, target: e.target.value })}
                          className="h-11 sm:h-10 text-sm w-full"
                        />
                      </div>
                      <div className="space-y-2 max-w-full">
                        <label className="text-xs font-medium text-muted-foreground">Action (Optional)</label>
                        <Select
                          value={workflowParameters.action || ""}
                          onValueChange={(value) => setWorkflowParameters({ ...workflowParameters, action: value })}
                        >
                          <SelectTrigger className="h-11 sm:h-10 text-sm w-full">
                            <SelectValue placeholder="Select action type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="analyze">Analyze</SelectItem>
                            <SelectItem value="process">Process</SelectItem>
                            <SelectItem value="generate">Generate</SelectItem>
                            <SelectItem value="optimize">Optimize</SelectItem>
                            <SelectItem value="validate">Validate</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 max-w-full">
                        <label className="text-xs font-medium text-muted-foreground">
                          Additional Parameters (Optional)
                        </label>
                        <Textarea
                          placeholder="Add any additional parameters as key-value pairs..."
                          value={workflowParameters.notes || ""}
                          onChange={(e) => setWorkflowParameters({ ...workflowParameters, notes: e.target.value })}
                          className="min-h-[80px] sm:min-h-[60px] text-sm resize-none w-full"
                        />
                      </div>
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground leading-relaxed break-words">
                          💡 Tip: Parameters are optional. The workflow will use default values if none are provided.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* AI Model selector for execution */}
                  <div className="space-y-2 max-w-full">
                    <label className="text-sm sm:text-base font-medium">AI Model</label>
                    <Select
                      value={selectedWorkflow?.ai_model || formData.ai_model} // Prefer workflow's model, fallback to form default
                      onValueChange={(value) => {
                        // Update formData to potentially reflect user's selection if they want to override
                        setFormData((prev) => ({ ...prev, ai_model: value }))
                        // Update selectedWorkflow if needed, or rely on runWorkflow passing it
                        // For execution, we primarily need to pass the selected model to runWorkflow
                        // so if we don't have a selectedWorkflow.ai_model, we use formData.ai_model
                      }}
                    >
                      <SelectTrigger className="h-11 sm:h-10 text-sm w-full">
                        <SelectValue placeholder="Select AI model" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</SelectItem>
                        <SelectItem value="claude-3-opus-20240229">Claude 3 Opus</SelectItem>
                        <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                        <SelectItem value="gpt-4">GPT-4</SelectItem>
                        <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                        <SelectItem value="gemini-pro">Gemini Pro</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Choose which AI model will execute this workflow. Defaults to the workflow's saved model if
                      available.
                    </p>
                  </div>

                  {availableAssets.length > 0 && (
                    <div className="space-y-2 max-w-full">
                      <label className="text-sm sm:text-base font-medium">Asset Context (Optional)</label>
                      <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
                        Select assets to provide context during execution
                      </p>
                      <ScrollArea className="h-40 sm:h-48 border rounded-md p-2 sm:p-3 w-full">
                        <div className="space-y-2">
                          {availableAssets.map((asset) => (
                            <div
                              key={asset.id}
                              className="flex items-start space-x-3 p-2.5 sm:p-2 rounded-lg hover:bg-muted/50 transition-colors touch-manipulation"
                            >
                              <input
                                type="checkbox"
                                id={`exec-asset-${asset.id}`}
                                checked={selectedAssets.includes(asset.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedAssets([...selectedAssets, asset.id])
                                  } else {
                                    setSelectedAssets(selectedAssets.filter((id) => id !== asset.id))
                                  }
                                }}
                                className="rounded w-5 h-5 sm:w-4 sm:h-4 flex-shrink-0 mt-0.5"
                              />
                              <label htmlFor={`exec-asset-${asset.id}`} className="flex-1 cursor-pointer min-w-0">
                                <div>
                                  <p className="text-sm font-medium break-words leading-tight">{asset.name}</p>
                                  <p className="text-xs text-muted-foreground break-words">
                                    {asset.asset_type} {asset.category && `• ${asset.category}`}
                                  </p>
                                </div>
                              </label>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                      {selectedAssets.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {selectedAssets.length} asset{selectedAssets.length !== 1 ? "s" : ""} selected for context
                        </p>
                      )}
                    </div>
                  )}

                  <div className="max-w-full">
                    <DataSourceSelector
                      selectedTables={selectedTables}
                      selectedEndpoints={selectedEndpoints}
                      includeLearningData={includeLearningData}
                      onTablesChange={setSelectedTables}
                      onEndpointsChange={setSelectedEndpoints}
                      onLearningDataChange={setIncludeLearningData}
                      mode="input"
                    />
                  </div>

                  <div className="max-w-full">
                    <DataStreamSelector
                      selectedStreams={selectedDataStreams}
                      onStreamsChange={setSelectedDataStreams}
                      mode="input"
                    />
                  </div>

                  <div className="flex items-start space-x-2 p-2.5 sm:p-3 border rounded-lg bg-muted/30 max-w-full">
                    <input
                      type="checkbox"
                      id="save-workflow-to-learning"
                      checked={saveToLearning}
                      onChange={(e) => setSaveToLearning(e.target.checked)}
                      className="rounded w-5 h-5 sm:w-4 sm:h-4 flex-shrink-0 mt-0.5"
                    />
                    <label
                      htmlFor="save-workflow-to-learning"
                      className="text-sm font-medium cursor-pointer flex-1 min-w-0"
                    >
                      Save to Learning Layer
                      <p className="text-xs text-muted-foreground font-normal mt-1 leading-relaxed break-words">
                        Store this execution result to improve future AI responses through continuous learning
                      </p>
                    </label>
                  </div>
                </>
              )}

              {executionResult && <WorkflowExecutionReport result={executionResult} />}
            </div>
          </ScrollArea>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
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
                setWorkflowParameters({})
                setExecutionResult(null)
              }}
              className="w-full sm:w-auto"
            >
              Close
            </Button>
            {!executionResult && (
              <Button onClick={runWorkflow} disabled={isLoading} className="w-full sm:w-auto">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  "Execute Workflow"
                )}
              </Button>
            )}
            {executionResult && (
              <Button
                onClick={saveToLearningLayer}
                disabled={isSavingToLearning}
                className="w-full sm:w-auto"
                variant="default"
              >
                {isSavingToLearning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Save to Learning Layer
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
