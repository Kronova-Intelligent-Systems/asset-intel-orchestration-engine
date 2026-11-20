"use client"

import type React from "react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { submitFeedback } from "@/app/actions/feedback"
import { MessageSquare, Bug, Lightbulb, X } from "lucide-react"

const feedbackReportSchema = z.object({
  type: z.enum(["feedback", "bug", "feature_request"]),
  title: z.string().min(5, "Title must be at least 5 characters").max(255, "Title must be less than 255 characters"),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(2000, "Description must be less than 2000 characters"),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  tags: z.array(z.string()).optional(),
  pageUrl: z.string().optional(),
  userAgent: z.string().optional(),
  browserInfo: z.record(z.string(), z.any()).optional(),
})

type FeedbackReport = z.infer<typeof feedbackReportSchema>

interface FeedbackModalProps {
  children: React.ReactNode
  defaultType?: "feedback" | "bug" | "feature_request"
}

export function FeedbackModal({ children, defaultType = "feedback" }: FeedbackModalProps) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  const form = useForm<FeedbackReport>({
    resolver: zodResolver(feedbackReportSchema),
    defaultValues: {
      type: defaultType,
      title: "",
      description: "",
      priority: "medium",
      tags: [],
    },
  })

  const predefinedTags = [
    "ui/ux",
    "performance",
    "mobile",
    "desktop",
    "accessibility",
    "navigation",
    "forms",
    "authentication",
    "dashboard",
    "api",
    "shipping",
    "ai-suite",
    "rewards",
    "packaging",
    "sustainability",
  ]

  const addTag = (tag: string) => {
    if (!selectedTags.includes(tag)) {
      const newTags = [...selectedTags, tag]
      setSelectedTags(newTags)
      form.setValue("tags", newTags)
    }
  }

  const removeTag = (tag: string) => {
    const newTags = selectedTags.filter((t) => t !== tag)
    setSelectedTags(newTags)
    form.setValue("tags", newTags)
  }

  const getBrowserInfo = () => {
    try {
      if (typeof window === "undefined") return {}

      return {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine,
        screen: {
          width: screen.width,
          height: screen.height,
          colorDepth: screen.colorDepth,
        },
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        url: window.location.href,
        referrer: document.referrer,
      }
    } catch (error) {
      console.error("[v0] Error getting browser info:", error)
      return {}
    }
  }

  const onSubmit = async (data: FeedbackReport) => {
    console.log("[v0] Feedback modal submit started", data)
    setIsSubmitting(true)

    try {
      const browserInfo = getBrowserInfo()

      const submitData = {
        ...data,
        pageUrl: typeof window !== "undefined" ? window.location.href : undefined,
        userAgent: typeof window !== "undefined" ? navigator.userAgent : undefined,
        browserInfo,
        tags: selectedTags,
      }

      console.log("[v0] Submitting feedback data:", submitData)

      const result = await submitFeedback(submitData)

      console.log("[v0] Feedback submission result:", result)

      if (result.success) {
        toast.success("Feedback submitted!", {
          description: "Thank you for your feedback. We'll review it shortly.",
        })
        form.reset()
        setSelectedTags([])
        setOpen(false)
      } else {
        console.error("[v0] Feedback submission error:", result.error)
        toast.error("Error", {
          description: result.error || "Failed to submit feedback",
        })
      }
    } catch (error) {
      console.error("[v0] Feedback submission exception:", error)
      toast.error("Error", {
        description: "An unexpected error occurred. Please try again.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "bug":
        return <Bug className="h-4 w-4" />
      case "feature_request":
        return <Lightbulb className="h-4 w-4" />
      default:
        return <MessageSquare className="h-4 w-4" />
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "bug":
        return "Bug Report"
      case "feature_request":
        return "Feature Request"
      default:
        return "General Feedback"
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getTypeIcon(form.watch("type"))}
            Submit {getTypeLabel(form.watch("type"))}
          </DialogTitle>
          <DialogDescription>
            Help us improve by sharing your feedback, reporting bugs, or suggesting new features.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select feedback type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="feedback">General Feedback</SelectItem>
                      <SelectItem value="bug">Bug Report</SelectItem>
                      <SelectItem value="feature_request">Feature Request</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Brief summary of your feedback" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Please provide detailed information about your feedback, including steps to reproduce if reporting a bug"
                      className="min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Be as specific as possible to help us understand and address your feedback.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3">
              <FormLabel>Tags (Optional)</FormLabel>
              <div className="flex flex-wrap gap-2">
                {predefinedTags.map((tag) => (
                  <Button
                    key={tag}
                    type="button"
                    variant={selectedTags.includes(tag) ? "default" : "outline"}
                    size="sm"
                    onClick={() => (selectedTags.includes(tag) ? removeTag(tag) : addTag(tag))}
                  >
                    {tag}
                  </Button>
                ))}
              </div>
              {selectedTags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedTags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                      {tag}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => removeTag(tag)} />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit Feedback"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
