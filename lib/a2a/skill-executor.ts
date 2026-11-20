import { executeSkill, SkillError, type SkillOutput } from "@/lib/ai/skills/registry"
import type { Message, Part, SendMessageRequest, TaskState } from "./kronova-a2a-client"

/**
 * A skill invocation is a message whose data part names a skill:
 *   { "type": "data", "data": { "skill": "<id>", "input": { ... }, "confirm": false } }
 * `skillId` in message or request metadata is also accepted, with the data part as input.
 * Both the `type` and `kind` part discriminators are accepted (A2A 1.0 and 0.3).
 */
export interface SkillInvocation {
  skillId: string
  input: Record<string, unknown>
  confirm: boolean
}

export function extractSkillInvocation(request: SendMessageRequest): SkillInvocation | null {
  const parts: any[] = Array.isArray(request.message?.parts) ? request.message.parts : []
  const dataPart = parts.find((part) => (part?.type ?? part?.kind) === "data" && part.data && typeof part.data === "object")
  const data: Record<string, any> = dataPart?.data ?? {}

  const metadataSkill = request.message?.metadata?.skillId ?? request.metadata?.skillId
  const skillId = typeof data.skill === "string" ? data.skill : typeof metadataSkill === "string" ? metadataSkill : null
  if (!skillId) return null

  const input =
    data.input && typeof data.input === "object" && !Array.isArray(data.input)
      ? data.input
      : typeof data.skill === "string"
        ? {}
        : data
  return { skillId, input, confirm: data.confirm === true }
}

/** Maps skill failures onto A2A task states: caller-side problems are "rejected", only server faults are "failed". */
export function stateForSkillError(error: SkillError): TaskState {
  return error.code === "INTERNAL" ? "failed" : "rejected"
}

function agentMessage(contextId: string, text: string, data?: Record<string, unknown>): Message {
  const parts: Part[] = [{ type: "text", text }]
  if (data) parts.push({ type: "data", data })
  return { messageId: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, role: "agent", parts, contextId }
}

export interface SkillTaskRuntime {
  supabase: any
  userId: string
  updateTaskStatus(taskId: string, status: { state: TaskState; timestamp?: string; message?: Message }): Promise<unknown>
  addArtifact(taskId: string, artifact: { artifactId: string; name?: string; description?: string; parts: Part[]; metadata?: Record<string, any> }): Promise<unknown>
}

/** Runs the requested skill for an existing task and moves it to a final state. Never throws. */
export async function runSkillForTask(
  runtime: SkillTaskRuntime,
  taskId: string,
  contextId: string,
  invocation: SkillInvocation,
): Promise<void> {
  const now = () => new Date().toISOString()
  try {
    await runtime.updateTaskStatus(taskId, { state: "working", timestamp: now() })

    let output: SkillOutput
    try {
      output = await executeSkill(invocation.skillId, invocation.input, {
        supabase: runtime.supabase,
        userId: runtime.userId,
        confirm: invocation.confirm,
      })
    } catch (error) {
      const skillError =
        error instanceof SkillError ? error : new SkillError("INTERNAL", "Skill execution failed unexpectedly")
      await runtime.updateTaskStatus(taskId, {
        state: stateForSkillError(skillError),
        timestamp: now(),
        message: agentMessage(contextId, skillError.message, {
          error: { code: skillError.code, message: skillError.message, ...(skillError.details && { details: skillError.details }) },
          skill: invocation.skillId,
        }),
      })
      return
    }

    await runtime.addArtifact(taskId, {
      artifactId: `artifact-${taskId}-${invocation.skillId}`,
      name: `${invocation.skillId} result`,
      description: output.summary,
      parts: [{ type: "data", data: { skill: invocation.skillId, ...output } }],
      metadata: { skill: invocation.skillId, dryRun: output.dryRun === true, dataSources: output.dataSources },
    })
    await runtime.updateTaskStatus(taskId, {
      state: "completed",
      timestamp: now(),
      message: agentMessage(contextId, output.dryRun ? `${output.summary} (dry run: nothing was written)` : output.summary),
    })
  } catch (error) {
    console.error("[a2a] skill task bookkeeping failed:", error instanceof Error ? error.message : error)
    await runtime
      .updateTaskStatus(taskId, {
        state: "failed",
        timestamp: now(),
        message: agentMessage(contextId, "The task could not be completed."),
      })
      .catch(() => undefined)
  }
}
