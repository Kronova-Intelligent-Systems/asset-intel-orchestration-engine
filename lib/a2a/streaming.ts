/**
 * A2A streaming over Server-Sent Events.
 *
 * Tasks are stored in the database and change when an agent updates their status or adds
 * artifacts, so a stream watches the task and emits an event for each change until the
 * task reaches a final state, the client disconnects, or the deadline passes. A client that
 * is cut off at the deadline can reconnect with tasks/resubscribe.
 */

import { TaskNotFoundError } from "./kronova-a2a-client"
import type { Artifact, KronovaA2AClient, Task, TaskState, TaskStatus } from "./kronova-a2a-client"

export const STREAM_POLL_INTERVAL_MS = 1_000
export const STREAM_KEEPALIVE_MS = 15_000
// Stays under the route's 300 second maxDuration
export const STREAM_DEADLINE_MS = 270_000

const TERMINAL_STATES: TaskState[] = ["completed", "failed", "canceled", "rejected"]

export function isTerminalState(state: TaskState): boolean {
  return TERMINAL_STATES.includes(state)
}

export type TaskWatchEvent =
  | { type: "status"; status: TaskStatus; final: boolean }
  | { type: "artifact"; artifact: Artifact }
  | { type: "keepalive" }

export interface WatchOptions {
  signal: AbortSignal
  pollMs?: number
  keepaliveMs?: number
  deadlineMs?: number
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve()
    const finish = () => {
      clearTimeout(timer)
      signal.removeEventListener("abort", finish)
      resolve()
    }
    const timer = setTimeout(finish, ms)
    signal.addEventListener("abort", finish, { once: true })
  })
}

const statusSignature = (task: Task) =>
  JSON.stringify([task.status.state, task.status.timestamp ?? null, task.status.message ?? null])

const artifactSignature = (artifact: Artifact) => JSON.stringify([artifact.artifactId, artifact.index ?? null, artifact.parts])

/** Yields changes to a task after `initial`. A status of input-required also ends the stream, as the spec requires. */
export async function* watchTask(
  client: KronovaA2AClient,
  initial: Task,
  options: WatchOptions,
): AsyncGenerator<TaskWatchEvent> {
  const { signal, pollMs = STREAM_POLL_INTERVAL_MS, keepaliveMs = STREAM_KEEPALIVE_MS, deadlineMs = STREAM_DEADLINE_MS } = options
  if (isTerminalState(initial.status.state)) return

  const seenArtifacts = new Set((initial.artifacts ?? []).map(artifactSignature))
  let lastStatus = statusSignature(initial)
  let lastEmit = Date.now()
  const deadline = Date.now() + deadlineMs

  while (!signal.aborted && Date.now() < deadline) {
    await sleep(pollMs, signal)
    if (signal.aborted) return

    let task: Task
    try {
      task = await client.getTask({ taskId: initial.id, historyLength: 0 })
    } catch (error) {
      if (error instanceof TaskNotFoundError) return
      continue
    }

    for (const artifact of task.artifacts ?? []) {
      const signature = artifactSignature(artifact)
      if (seenArtifacts.has(signature)) continue
      seenArtifacts.add(signature)
      lastEmit = Date.now()
      yield { type: "artifact", artifact }
    }

    const signature = statusSignature(task)
    if (signature !== lastStatus) {
      lastStatus = signature
      lastEmit = Date.now()
      const final = isTerminalState(task.status.state) || task.status.state === "input-required"
      yield { type: "status", status: task.status, final }
      if (final) return
    } else if (Date.now() - lastEmit >= keepaliveMs) {
      lastEmit = Date.now()
      yield { type: "keepalive" }
    }
  }
}

export const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  "X-Accel-Buffering": "no",
  "Access-Control-Allow-Origin": "*",
} as const

/** Wraps a generator of ready-made SSE frames in a streaming Response. */
export function sseResponse(frames: AsyncGenerator<string>, onError: (error: unknown) => string): Response {
  const encoder = new TextEncoder()
  return new Response(
    new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const next = await frames.next()
          if (next.done) controller.close()
          else controller.enqueue(encoder.encode(next.value))
        } catch (error) {
          controller.enqueue(encoder.encode(onError(error)))
          controller.close()
        }
      },
      async cancel() {
        await frames.return(undefined)
      },
    }),
    { headers: SSE_HEADERS },
  )
}
