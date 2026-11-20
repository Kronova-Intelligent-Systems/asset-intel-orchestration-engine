import { z } from "zod"

// CRM Connection Schemas
export const crmProviderSchema = z.enum(["salesforce", "crmone", "netsuite"])

export const crmConnectionSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  provider: crmProviderSchema,
  name: z.string().min(1, "Connection name is required"),
  api_key: z.string().optional().nullable(),
  refresh_token: z.string().optional().nullable(),
  access_token: z.string().optional().nullable(),
  instance_url: z.string().url().optional().nullable(),
  expires_at: z.string().datetime().optional().nullable(),
  last_sync_at: z.string().datetime().optional().nullable(),
  is_active: z.boolean().default(true),
})

export const createCrmConnectionSchema = crmConnectionSchema.omit({ id: true })

export const updateCrmConnectionSchema = crmConnectionSchema.partial().required({
  id: true,
})

// CRM Contact Schemas
export const crmContactSchema = z.object({
  id: z.string().uuid().optional(),
  connection_id: z.string().uuid(),
  user_id: z.string().uuid(),
  external_id: z.string(),
  first_name: z.string().optional().nullable(),
  last_name: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  job_title: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  last_contacted: z.string().datetime().optional().nullable(),
  status: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  custom_fields: z.record(z.string(), z.any()).optional().nullable(),
})

export const createCrmContactSchema = crmContactSchema.omit({ id: true })

export const updateCrmContactSchema = crmContactSchema.partial().required({
  id: true,
})

// CRM Deal Schemas
export const crmDealSchema = z.object({
  id: z.string().uuid().optional(),
  connection_id: z.string().uuid(),
  user_id: z.string().uuid(),
  external_id: z.string(),
  name: z.string(),
  stage: z.string().optional().nullable(),
  amount: z.number().optional().nullable(),
  currency: z.string().optional().nullable(),
  close_date: z.string().datetime().optional().nullable(),
  probability: z.number().min(0).max(100).optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
  description: z.string().optional().nullable(),
  custom_fields: z.record(z.string(), z.any()).optional().nullable(),
})

export const createCrmDealSchema = crmDealSchema.omit({ id: true })

export const updateCrmDealSchema = crmDealSchema.partial().required({
  id: true,
})

// CRM Activity Schemas
export const crmActivityTypeSchema = z.enum(["call", "email", "meeting", "task"])

export const crmActivitySchema = z.object({
  id: z.string().uuid().optional(),
  connection_id: z.string().uuid(),
  user_id: z.string().uuid(),
  external_id: z.string(),
  type: crmActivityTypeSchema,
  subject: z.string(),
  description: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  priority: z.string().optional().nullable(),
  due_date: z.string().datetime().optional().nullable(),
  completed_date: z.string().datetime().optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
  deal_id: z.string().uuid().optional().nullable(),
  custom_fields: z.record(z.string(), z.any()).optional().nullable(),
})

export const createCrmActivitySchema = crmActivitySchema.omit({ id: true })

export const updateCrmActivitySchema = crmActivitySchema.partial().required({
  id: true,
})

// CRM API Schemas
export const salesforceAuthSchema = z.object({
  client_id: z.string(),
  client_secret: z.string(),
  username: z.string().email(),
  password: z.string(),
  security_token: z.string().optional(),
})

export const crmOneAuthSchema = z.object({
  api_key: z.string(),
  subdomain: z.string(),
})

export const netsuiteAuthSchema = z.object({
  account_id: z.string(),
  consumer_key: z.string(),
  consumer_secret: z.string(),
  token_id: z.string(),
  token_secret: z.string(),
})

export const crmAuthSchema = z.discriminatedUnion("provider", [
  z.object({ provider: z.literal("salesforce"), credentials: salesforceAuthSchema }),
  z.object({ provider: z.literal("crmone"), credentials: crmOneAuthSchema }),
  z.object({ provider: z.literal("netsuite"), credentials: netsuiteAuthSchema }),
])

export type CrmProvider = z.infer<typeof crmProviderSchema>
export type CrmConnection = z.infer<typeof crmConnectionSchema>
export type CreateCrmConnection = z.infer<typeof createCrmConnectionSchema>
export type UpdateCrmConnection = z.infer<typeof updateCrmConnectionSchema>
export type CrmContact = z.infer<typeof crmContactSchema>
export type CreateCrmContact = z.infer<typeof createCrmContactSchema>
export type UpdateCrmContact = z.infer<typeof updateCrmContactSchema>
export type CrmDeal = z.infer<typeof crmDealSchema>
export type CreateCrmDeal = z.infer<typeof createCrmDealSchema>
export type UpdateCrmDeal = z.infer<typeof updateCrmDealSchema>
export type CrmActivityType = z.infer<typeof crmActivityTypeSchema>
export type CrmActivity = z.infer<typeof crmActivitySchema>
export type CreateCrmActivity = z.infer<typeof createCrmActivitySchema>
export type UpdateCrmActivity = z.infer<typeof updateCrmActivitySchema>
export type CrmAuth = z.infer<typeof crmAuthSchema>
