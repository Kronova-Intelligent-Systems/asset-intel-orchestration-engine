"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  uploadFileForEmbedding,
  createEmbeddingFromText,
  createEmbeddingsFromDatabase, // New action
} from "@/app/actions/embedding-actions"
import { toast } from "@/components/ui/use-toast"
import { Upload, Loader2, FileText, File, X, Code, Database, AlertCircle } from "lucide-react"
import type { AIModel, DatabaseConnection } from "@/lib/types/database" // Added DatabaseConnection
import { getDatabaseConnections } from "@/app/actions/ai-actions" // Action to fetch DB connections
import { isSupportedEmbeddingModel } from "@/lib/embeddings/supported-models"
import { SUPPORTED_IMPORT_EXTENSIONS } from "@/lib/embeddings/import-file-types"

interface EmbeddingsUploaderProps {
  userId: string
  embeddingModels: AIModel[]
  defaultSettings: any
  refreshData: () => void
  // No need to pass databaseConnections as prop, fetch it internally
}

function describeImport(result: {
  storedCount: number
  failedCount: number
  learningLayerId?: string
  warnings: string[]
}) {
  const parts = [`${result.storedCount} chunks embedded`]
  if (result.learningLayerId) parts.push("added to the learning layer")
  if (result.failedCount > 0) parts.push(`${result.failedCount} failed`)
  const summary = parts.join(", ")
  return result.warnings.length > 0 ? `${summary}. ${result.warnings.join(" ")}` : summary
}

export function EmbeddingsUploader({ userId, embeddingModels, defaultSettings, refreshData }: EmbeddingsUploaderProps) {
  const supportedModels = (embeddingModels ?? []).filter((model) => isSupportedEmbeddingModel(model.model_id))
  const [activeTab, setActiveTab] = useState("file")
  const [isProcessing, setIsProcessing] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [databaseConnections, setDatabaseConnections] = useState<DatabaseConnection[]>([])
  const [isLoadingConnections, setIsLoadingConnections] = useState(false)

  const [form, setForm] = useState({
    name: "",
    description: "",
    modelId: supportedModels.length > 0 ? supportedModels[0].id : "",
    chunkSize: defaultSettings?.defaultChunkSize || 1000,
    chunkOverlap: defaultSettings?.defaultChunkOverlap || 200,
    textContent: "",
    addToLearningLayer: false,
    // Database specific form fields
    selectedDbConnectionId: "",
    dbQuery: "", // Or table name, column names etc.
  })
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const fetchConnections = async () => {
      if (activeTab === "database") {
        setIsLoadingConnections(true)
        try {
          const connections = await getDatabaseConnections() // Fetches for the current user
          setDatabaseConnections(connections.filter((c) => c.last_test_status === "success" && c.is_active))
        } catch (error) {
          console.error("Error fetching database connections:", error)
          toast({
            title: "Error fetching connections",
            description: "Could not load your database connections.",
            variant: "destructive",
          })
          setDatabaseConnections([])
        } finally {
          setIsLoadingConnections(false)
        }
      }
    }
    fetchConnections()
  }, [activeTab, userId])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files)
      setFiles((prev) => [...prev, ...newFiles])
    }
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const resetCommonFormFields = () => {
    setForm((prev) => ({
      ...prev,
      name: "",
      description: "",
      textContent: "",
      selectedDbConnectionId: "",
      dbQuery: "",
    }))
    setFiles([])
  }

  const handleSubmitFiles = async (e: React.FormEvent) => {
    e.preventDefault()
    if (files.length === 0) {
      toast({ title: "No files selected", description: "Please select at least one file.", variant: "destructive" })
      return
    }
    const maxFileSize = 100 * 1024 * 1024 // 100MB
    const oversizedFiles = files.filter((file) => file.size > maxFileSize)
    if (oversizedFiles.length > 0) {
      toast({
        title: "File too large",
        description: `Files exceed 100MB limit: ${oversizedFiles.map((f) => f.name).join(", ")}`,
        variant: "destructive",
      })
      return
    }
    if (!form.name) {
      toast({
        title: "Name required",
        description: "Please provide a name for your embeddings.",
        variant: "destructive",
      })
      return
    }
    setIsProcessing(true)
    try {
      const formData = new FormData()
      files.forEach((file) => formData.append("files", file))
      formData.append("name", form.name)
      formData.append("description", form.description)
      formData.append("modelId", form.modelId)
      formData.append("chunkSize", form.chunkSize.toString())
      formData.append("chunkOverlap", form.chunkOverlap.toString())
      formData.append("addToLearningLayer", String(form.addToLearningLayer))
      const result = await uploadFileForEmbedding(formData)
      toast({
        title: "Import complete",
        description: describeImport(result),
      })
      resetCommonFormFields()
      refreshData()
    } catch (error: any) {
      console.error("Error uploading files:", error)
      toast({
        title: "Upload failed",
        description: error.message || "There was an error uploading files.",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSubmitText = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.textContent.trim()) {
      toast({
        title: "No text provided",
        description: "Please enter text to create embeddings.",
        variant: "destructive",
      })
      return
    }
    if (!form.name) {
      toast({
        title: "Name required",
        description: "Please provide a name for your embeddings.",
        variant: "destructive",
      })
      return
    }
    const maxTextLength = 10 * 1024 * 1024 // 10MB for text
    if (form.textContent.length > maxTextLength) {
      toast({ title: "Text too large", description: `Text content exceeds the 10MB limit.`, variant: "destructive" })
      return
    }
    setIsProcessing(true)
    try {
      const result = await createEmbeddingFromText({
        name: form.name,
        description: form.description,
        modelId: form.modelId,
        chunkSize: form.chunkSize,
        chunkOverlap: form.chunkOverlap,
        textContent: form.textContent,
        addToLearningLayer: form.addToLearningLayer,
      })
      toast({ title: "Import complete", description: describeImport(result) })
      resetCommonFormFields()
      refreshData()
    } catch (error: any) {
      console.error("Error processing text:", error)
      toast({
        title: "Processing failed",
        description: error.message || "Error processing text.",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSubmitDatabase = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.selectedDbConnectionId) {
      toast({
        title: "No database selected",
        description: "Please select a database connection.",
        variant: "destructive",
      })
      return
    }
    if (!form.name) {
      toast({
        title: "Name required",
        description: "Please provide a name for your embeddings.",
        variant: "destructive",
      })
      return
    }
    if (!form.dbQuery.trim()) {
      // Basic check, could be more specific (table, columns)
      toast({
        title: "Query or Table required",
        description: "Please specify the data to embed (e.g., SQL query or table name).",
        variant: "destructive",
      })
      return
    }
    setIsProcessing(true)
    try {
      // This is a placeholder call. The actual implementation of createEmbeddingsFromDatabase
      // would handle connecting to the DB, fetching data, chunking, and embedding.
      const result = await createEmbeddingsFromDatabase({
        userId,
        name: form.name,
        description: form.description,
        modelId: form.modelId,
        chunkSize: form.chunkSize,
        chunkOverlap: form.chunkOverlap,
        connectionId: form.selectedDbConnectionId,
        query: form.dbQuery, // Or table/column details
      })

      if (result.success) {
        toast({ title: "Database embedding job started", description: "Processing data from your database." })
        resetCommonFormFields()
        refreshData()
      } else {
        toast({
          title: "Failed to start job",
          description: result.error || "Could not start database embedding job.",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      console.error("Error processing database source:", error)
      toast({
        title: "Processing failed",
        description: error.message || "Error processing database source.",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const getFileIcon = (file: File) => {
    const extension = file.name.split(".").pop()?.toLowerCase()
    switch (extension) {
      case "pdf":
        return <FileText className="h-5 w-5 text-red-500" />
      case "doc":
      case "docx":
        return <FileText className="h-5 w-5 text-blue-500" />
      case "txt":
        return <FileText className="h-5 w-5 text-gray-500" />
      case "csv":
      case "xlsx":
      case "xls":
        return <FileText className="h-5 w-5 text-green-500" />
      case "json":
        return <Code className="h-5 w-5 text-yellow-500" />
      case "md":
        return <FileText className="h-5 w-5 text-purple-500" />
      default:
        return <File className="h-5 w-5" />
    }
  }

  const commonEmbeddingFields = (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor={`name-${activeTab}`}>Name</Label>
          <Input
            id={`name-${activeTab}`}
            placeholder="My New Embeddings"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`model-${activeTab}`}>Embedding Model</Label>
          <Select value={form.modelId} onValueChange={(value) => setForm({ ...form, modelId: value })}>
            <SelectTrigger id={`model-${activeTab}`}>
              <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent>
              {supportedModels.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.name} ({model.provider})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`description-${activeTab}`}>Description (Optional)</Label>
        <Textarea
          id={`description-${activeTab}`}
          placeholder="Description of these embeddings"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor={`chunkSize-${activeTab}`}>Chunk Size: {form.chunkSize}</Label>
          <Slider
            id={`chunkSize-${activeTab}`}
            min={200}
            max={4000}
            step={50}
            value={[form.chunkSize]}
            onValueChange={(value) => setForm({ ...form, chunkSize: value[0] })}
          />
          <p className="text-xs text-muted-foreground">
            Characters per chunk. Smaller chunks are more precise but may lose context.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`chunkOverlap-${activeTab}`}>Chunk Overlap: {form.chunkOverlap}</Label>
          <Slider
            id={`chunkOverlap-${activeTab}`}
            min={0}
            max={1000}
            step={10}
            value={[form.chunkOverlap]}
            onValueChange={(value) => setForm({ ...form, chunkOverlap: value[0] })}
          />
          <p className="text-xs text-muted-foreground">Characters shared between chunks to maintain context.</p>
        </div>
      </div>
      {activeTab !== "database" && (
        <div className="flex items-start gap-3 rounded-md border p-3">
          <input
            id={`learning-${activeTab}`}
            type="checkbox"
            className="mt-1 h-4 w-4 accent-primary"
            checked={form.addToLearningLayer}
            onChange={(e) => setForm({ ...form, addToLearningLayer: e.target.checked })}
          />
          <div className="space-y-1">
            <Label htmlFor={`learning-${activeTab}`}>Also add to the learning layer</Label>
            <p className="text-xs text-muted-foreground">
              Saves a searchable summary of this dataset next to your agent and workflow learnings, so agents can
              discover it. Chunk-level search stays in your embeddings.
            </p>
          </div>
        </div>
      )}
    </>
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Embeddings</CardTitle>
        <CardDescription>
          Upload files, enter text, or connect to a database to create embeddings for RAG.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="file" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span>From Files</span>
            </TabsTrigger>
            <TabsTrigger value="text" className="flex items-center gap-2">
              <Code className="h-4 w-4" />
              <span>From Text</span>
            </TabsTrigger>
            <TabsTrigger value="database" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              <span>From Database</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="file">
            <form onSubmit={handleSubmitFiles} className="space-y-6">
              {commonEmbeddingFields}
              <div className="space-y-2">
                <Label htmlFor="files">Upload Files</Label>
                <div
                  className="border-2 border-dashed rounded-md p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Input
                    id="files"
                    type="file"
                    multiple
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept={SUPPORTED_IMPORT_EXTENSIONS.join(",")}
                  />
                  <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground text-center">Click to upload or drag and drop</p>
                  <p className="text-xs text-muted-foreground text-center mt-1">
                    PDF, TXT, MD, CSV, JSON, HTML, XML, YAML (Max 100MB per file). Export Word and Excel files as PDF
                    or CSV first.
                  </p>
                </div>
              </div>
              {files.length > 0 && (
                <div className="space-y-2">
                  <Label>Selected Files ({files.length})</Label>
                  <div className="border rounded-md divide-y max-h-60 overflow-y-auto">
                    {files.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2">
                        <div className="flex items-center space-x-2 overflow-hidden">
                          {getFileIcon(file)}
                          <span className="text-sm truncate">{file.name}</span>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            ({(file.size / 1024 / 1024).toFixed(1)} MB)
                          </span>
                        </div>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeFile(index)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <Button type="submit" className="w-full" disabled={isProcessing || files.length === 0}>
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>Upload and Process Files</>
                )}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="text">
            <form onSubmit={handleSubmitText} className="space-y-6">
              {commonEmbeddingFields}
              <div className="space-y-2">
                <Label htmlFor="textContent">Text Content</Label>
                <Textarea
                  id="textContent"
                  placeholder="Enter text to create embeddings from (Max 10MB)"
                  value={form.textContent}
                  onChange={(e) => setForm({ ...form, textContent: e.target.value })}
                  className="min-h-[200px]"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isProcessing || !form.textContent.trim()}>
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>Process Text</>
                )}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="database">
            <form onSubmit={handleSubmitDatabase} className="space-y-6">
              {commonEmbeddingFields}
              <div className="space-y-2">
                <Label htmlFor="dbConnection">Database Connection</Label>
                {isLoadingConnections ? (
                  <div className="flex items-center space-x-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading connections...</span>
                  </div>
                ) : databaseConnections.length > 0 ? (
                  <Select
                    value={form.selectedDbConnectionId}
                    onValueChange={(value) => setForm({ ...form, selectedDbConnectionId: value })}
                  >
                    <SelectTrigger id="dbConnection">
                      <SelectValue placeholder="Select a database connection" />
                    </SelectTrigger>
                    <SelectContent>
                      {databaseConnections.map((conn) => (
                        <SelectItem key={conn.id} value={conn.id}>
                          {conn.name} ({conn.connection_type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="p-4 border rounded-md bg-muted/50 text-center text-sm text-muted-foreground">
                    <AlertCircle className="mx-auto h-8 w-8 mb-2" />
                    No active and successfully tested database connections found.
                    <br />
                    Please{" "}
                    <a href="/ai-suite/data-sources" className="underline text-primary hover:text-primary/80">
                      add and test a connection
                    </a>{" "}
                    first.
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="dbQuery">SQL Query or Table/Column Specification</Label>
                <Textarea
                  id="dbQuery"
                  placeholder="e.g., SELECT id, content FROM documents_table WHERE category = 'knowledge_base';"
                  value={form.dbQuery}
                  onChange={(e) => setForm({ ...form, dbQuery: e.target.value })}
                  className="min-h-[100px]"
                  required
                  disabled={isLoadingConnections || databaseConnections.length === 0}
                />
                <p className="text-xs text-muted-foreground">
                  Specify the SQL query to fetch data. Ensure the query returns text content suitable for embedding.
                  Alternatively, in future updates, you might select tables/columns directly.
                </p>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={
                  isProcessing ||
                  !form.selectedDbConnectionId ||
                  !form.dbQuery.trim() ||
                  isLoadingConnections ||
                  databaseConnections.length === 0
                }
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Starting Job...
                  </>
                ) : (
                  <>
                    <Database className="mr-2 h-4 w-4" />
                    Process Database
                  </>
                )}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
