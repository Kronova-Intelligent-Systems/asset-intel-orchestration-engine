/**
 * Agent-system adapter for the Kronova skill registry.
 *
 * The 18 proprietary tools now live in `lib/ai/skills`. This module exposes the ones
 * that can actually run as agent tools, so an LLM is never offered a stub. Skills that
 * can write are always executed as a dry run here: an autonomous model must not
 * confirm its own writes. Writes go through A2A with an explicit `confirm: true`.
 */

import type { Tool } from "./agent-system"
import { executeSkill, listSkills, SkillError } from "./skills/registry"

async function resolveUserId(supabase: any, userId?: string): Promise<string | null> {
  if (userId) return userId
  try {
    const { data } = await supabase.auth.getUser()
    return data?.user?.id ?? null
  } catch {
    return null
  }
}

export function registerKronovaProprietaryTools(supabase: any, userId?: string): Tool[] {
  return listSkills(["live", "preview"]).map((skill) => ({
    name: skill.id,
    description: skill.description,
    parameters: skill.inputSchema,
    execute: async (params) => {
      const owner = await resolveUserId(supabase, userId)
      if (!owner) return { error: { code: "INVALID_INPUT", message: "No authenticated user for this skill" } }
      try {
        return await executeSkill(skill.id, params, { supabase, userId: owner, confirm: false })
      } catch (error) {
        if (error instanceof SkillError) {
          return { error: { code: error.code, message: error.message, ...(error.details && { details: error.details }) } }
        }
        return { error: { code: "INTERNAL", message: "Skill execution failed" } }
      }
    },
  }))
}

/** @deprecated Use registerKronovaProprietaryTools. Resend-It has been rebranded to Kronova. */
export function registerResendItProprietaryTools(supabase: any, userId?: string): Tool[] {
  return registerKronovaProprietaryTools(supabase, userId)
}
