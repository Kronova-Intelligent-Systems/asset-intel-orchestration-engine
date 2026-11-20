/**
 * Shared types for the Kronova skill registry.
 *
 * A skill is one of the 18 proprietary capabilities. Each skill declares an honest
 * `status` so callers (A2A agent cards, the agent system) never advertise something
 * that cannot run:
 *   - live:        runs against real tables and returns real data
 *   - preview:     runs read-only and returns a proposal/assessment; never fabricates
 *                  on-chain or third-party side effects
 *   - unavailable: declared but not implemented; always fails with NOT_IMPLEMENTED
 */

export type SkillStatus = "live" | "preview" | "unavailable"

export type SkillErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "AMBIGUOUS"
  | "NOT_IMPLEMENTED"
  | "UNSUPPORTED"
  | "INTERNAL"

export class SkillError extends Error {
  constructor(
    public readonly code: SkillErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = "SkillError"
  }
}

export interface SkillInputSchema {
  type: "object"
  properties: Record<string, SkillPropertySchema>
  required: string[]
}

export interface SkillPropertySchema {
  type: "string" | "integer" | "number" | "boolean" | "array" | "object"
  description?: string
  enum?: string[]
  default?: unknown
  minimum?: number
  maximum?: number
  maxLength?: number
  items?: { type: string; enum?: string[] }
}

export interface SkillContext {
  /** Supabase client. Row-level security applies for sessions; every query is also scoped by userId. */
  supabase: any
  /** Owner of the data. Every query must filter on this. */
  userId: string
  /** Writes only happen when the caller explicitly confirms. Otherwise skills run as a dry run. */
  confirm: boolean
}

export interface SkillOutput {
  summary: string
  data: Record<string, unknown>
  /** True when the skill could have written but did not (confirm was false). */
  dryRun?: boolean
  warnings?: string[]
  dataSources: string[]
}

export interface SkillDefinition {
  /** Stable identifier, equal to the legacy tool name. */
  id: string
  name: string
  description: string
  category: string
  tags: string[]
  status: SkillStatus
  /** Whether the skill can write when confirm is true. */
  mutates: boolean
  inputSchema: SkillInputSchema
  examples: string[]
  /** Tables the skill reads or writes. Empty for unavailable skills. */
  dataSources: string[]
  /** Why a skill is not fully live. */
  limitations?: string
  run?: (input: Record<string, any>, ctx: SkillContext) => Promise<SkillOutput>
}

const MAX_STRING = 2000
const MAX_ARRAY = 100

/** Validates input against a skill schema, applies defaults, drops unknown keys. */
export function validateSkillInput(schema: SkillInputSchema, raw: unknown): Record<string, any> {
  if (raw === undefined || raw === null) raw = {}
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new SkillError("INVALID_INPUT", "Skill input must be a JSON object")
  }
  const input = raw as Record<string, unknown>
  const out: Record<string, any> = {}

  for (const [key, prop] of Object.entries(schema.properties)) {
    let value = input[key]
    if (value === undefined || value === null) {
      if (prop.default !== undefined) value = prop.default
      else if (schema.required.includes(key)) throw new SkillError("INVALID_INPUT", `Missing required input: ${key}`)
      else continue
    }

    switch (prop.type) {
      case "string": {
        if (typeof value !== "string") throw new SkillError("INVALID_INPUT", `${key} must be a string`)
        if (value.length > (prop.maxLength ?? MAX_STRING)) {
          throw new SkillError("INVALID_INPUT", `${key} is too long`)
        }
        if (prop.enum && !prop.enum.includes(value)) {
          throw new SkillError("INVALID_INPUT", `${key} must be one of: ${prop.enum.join(", ")}`)
        }
        break
      }
      case "integer":
      case "number": {
        if (typeof value !== "number" || !Number.isFinite(value)) {
          throw new SkillError("INVALID_INPUT", `${key} must be a number`)
        }
        if (prop.type === "integer" && !Number.isInteger(value)) {
          throw new SkillError("INVALID_INPUT", `${key} must be an integer`)
        }
        if (prop.minimum !== undefined && value < prop.minimum) {
          throw new SkillError("INVALID_INPUT", `${key} must be at least ${prop.minimum}`)
        }
        if (prop.maximum !== undefined && value > prop.maximum) {
          throw new SkillError("INVALID_INPUT", `${key} must be at most ${prop.maximum}`)
        }
        break
      }
      case "boolean": {
        if (typeof value !== "boolean") throw new SkillError("INVALID_INPUT", `${key} must be a boolean`)
        break
      }
      case "array": {
        if (!Array.isArray(value)) throw new SkillError("INVALID_INPUT", `${key} must be an array`)
        if (value.length > MAX_ARRAY) throw new SkillError("INVALID_INPUT", `${key} has too many items`)
        if (prop.items?.type === "string") {
          for (const item of value) {
            if (typeof item !== "string") throw new SkillError("INVALID_INPUT", `${key} must contain only strings`)
            if (prop.items.enum && !prop.items.enum.includes(item)) {
              throw new SkillError("INVALID_INPUT", `${key} items must be one of: ${prop.items.enum.join(", ")}`)
            }
          }
        }
        break
      }
      case "object": {
        if (typeof value !== "object" || Array.isArray(value)) {
          throw new SkillError("INVALID_INPUT", `${key} must be an object`)
        }
        break
      }
    }
    out[key] = value
  }
  return out
}
