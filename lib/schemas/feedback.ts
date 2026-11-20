import { z } from "zod"

export const feedbackReportSchema = z.object({
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

export type FeedbackReport = z.infer<typeof feedbackReportSchema>

export interface FeedbackReportWithId extends FeedbackReport {
  id: string
  userId?: string
  status: "open" | "in_progress" | "resolved" | "closed"
  createdAt: string
  updatedAt: string
}
