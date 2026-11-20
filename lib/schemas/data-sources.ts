import { z } from "zod"

export const databaseConnectionTypeSchema = z.enum(["postgresql", "mysql", "sqlserver", "bigquery", "snowflake"])

// Base schema without refinement
const baseDatabaseConnectionSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(100),
  description: z.string().max(500).optional().nullable(),
  connection_type: databaseConnectionTypeSchema,
  host: z.string().optional().nullable(),
  port: z.coerce.number().positive().optional().nullable(),
  database_name: z.string().optional().nullable(),
  username: z.string().optional().nullable(),
  password: z.string().optional().nullable(),
  connection_string: z.string().optional().nullable(),
  ssl_mode: z.string().optional().nullable(),
  additional_params: z.record(z.string(), z.any()).optional().nullable(),
  is_active: z.boolean().default(true),
})

// Create schema with refinement
export const createDatabaseConnectionSchema = baseDatabaseConnectionSchema.refine(
  (data) => {
    // Basic validation: if not using connection_string, require host for some types
    if (!data.connection_string && ["postgresql", "mysql", "sqlserver"].includes(data.connection_type)) {
      return !!data.host && !!data.database_name && !!data.username
    }
    // For BigQuery, connection_string (as JSON key) or specific additional_params might be required
    if (data.connection_type === "bigquery" && !data.connection_string && !data.additional_params?.project_id) {
      return false
    }
    return true
  },
  {
    message: "Connection details are incomplete for the selected type.",
    path: ["host"],
  },
)

export type CreateDatabaseConnection = z.infer<typeof createDatabaseConnectionSchema>

// Update schema extends the base schema, not the refined one
export const updateDatabaseConnectionSchema = baseDatabaseConnectionSchema
  .extend({
    id: z.string().uuid(),
  })
  .refine(
    (data) => {
      // Same validation logic as create schema
      if (!data.connection_string && ["postgresql", "mysql", "sqlserver"].includes(data.connection_type)) {
        return !!data.host && !!data.database_name && !!data.username
      }
      if (data.connection_type === "bigquery" && !data.connection_string && !data.additional_params?.project_id) {
        return false
      }
      return true
    },
    {
      message: "Connection details are incomplete for the selected type.",
      path: ["host"],
    },
  )

export type UpdateDatabaseConnection = z.infer<typeof updateDatabaseConnectionSchema>
