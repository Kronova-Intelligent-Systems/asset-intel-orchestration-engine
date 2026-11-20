import { dataSkills } from "./data-skills"
import { platformSkills } from "./platform-skills"
import { deploymentSkills } from "./deployment-skills"
import {
  SkillError,
  validateSkillInput,
  type SkillContext,
  type SkillDefinition,
  type SkillOutput,
  type SkillStatus,
} from "./types"

export * from "./types"

/** All 18 skills. */
export const SKILLS: SkillDefinition[] = [...dataSkills, ...platformSkills, ...deploymentSkills]

const SKILL_INDEX = new Map(SKILLS.map((skill) => [skill.id, skill]))

export const SKILL_TIMEOUT_MS = 20_000

export function getSkill(id: string): SkillDefinition | undefined {
  return SKILL_INDEX.get(id)
}

export function listSkills(statuses?: SkillStatus[]): SkillDefinition[] {
  return statuses ? SKILLS.filter((skill) => statuses.includes(skill.status)) : SKILLS
}

/** Public, serializable view of a skill. Never includes the run function. */
export function describeSkill(skill: SkillDefinition) {
  return {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    category: skill.category,
    status: skill.status,
    mutates: skill.mutates,
    writesRequireConfirm: skill.mutates,
    inputSchema: skill.inputSchema,
    dataSources: skill.dataSources,
    limitations: skill.limitations ?? null,
    examples: skill.examples,
  }
}

/**
 * Skills that can actually run, shaped as A2A AgentSkill entries. Unavailable skills
 * are deliberately left out of agent cards so peers never discover something that
 * cannot be invoked; they remain visible in the full registry.
 */
export function toAgentCardSkills() {
  return listSkills(["live", "preview"]).map((skill) => ({
    id: skill.id,
    name: skill.name,
    description: `${skill.description}${skill.status === "preview" ? " (preview: proposal or review only)" : ""}${skill.mutates ? " Writes only when the message data part sets confirm: true." : ""}`,
    tags: [...skill.tags, skill.category.toLowerCase(), `status:${skill.status}`],
    inputModes: ["application/json"],
    outputModes: ["application/json"],
    examples: skill.examples.map((example) => `{"skill":"${skill.id}","input":${example}}`),
  }))
}

function withTimeout<T>(promise: Promise<T>, ms: number, skillId: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new SkillError("INTERNAL", `Skill "${skillId}" timed out after ${ms / 1000}s`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/**
 * Single execution path for A2A and the agent system: lookup, validation, scoping,
 * timeout and error normalization. Throws SkillError only.
 */
export async function executeSkill(skillId: string, rawInput: unknown, ctx: SkillContext): Promise<SkillOutput> {
  const skill = getSkill(skillId)
  if (!skill) throw new SkillError("NOT_FOUND", `Unknown skill "${skillId}"`, { availableSkills: SKILLS.map((s) => s.id) })
  if (!ctx.userId) throw new SkillError("INVALID_INPUT", "A user context is required to run a skill")
  if (skill.status === "unavailable" || !skill.run) {
    await skill.run?.({}, ctx)
    throw new SkillError("NOT_IMPLEMENTED", `Skill "${skillId}" is not implemented`)
  }

  const input = validateSkillInput(skill.inputSchema, rawInput)
  try {
    return await withTimeout(skill.run(input, ctx), SKILL_TIMEOUT_MS, skillId)
  } catch (error) {
    if (error instanceof SkillError) throw error
    console.error(`[skills] ${skillId} failed:`, error instanceof Error ? error.message : error)
    throw new SkillError("INTERNAL", `Skill "${skillId}" failed unexpectedly`)
  }
}
