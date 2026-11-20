/** Wire-format shaping shared by the JSON-RPC binding, SSE streams and push notifications. Adds the `kind` discriminators that A2A v0.3 clients require. */


export function decoratePart(part: any) {
  return part && typeof part === "object" ? { ...part, kind: part.type } : part
}

export function decorateMessage(message: any) {
  if (!message || typeof message !== "object") return message
  return { ...message, kind: "message", parts: Array.isArray(message.parts) ? message.parts.map(decoratePart) : message.parts }
}

export function decorateTask(task: any) {
  return {
    ...task,
    kind: "task",
    status: task.status ? { ...task.status, message: decorateMessage(task.status.message) } : task.status,
    history: Array.isArray(task.history) ? task.history.map(decorateMessage) : task.history,
    artifacts: Array.isArray(task.artifacts)
      ? task.artifacts.map((artifact: any) => ({
          ...artifact,
          parts: Array.isArray(artifact.parts) ? artifact.parts.map(decoratePart) : artifact.parts,
        }))
      : task.artifacts,
  }
}

export function decorateResult(result: any) {
  if (result && Array.isArray(result.tasks)) return { ...result, tasks: result.tasks.map(decorateTask) }
  if (result && typeof result === "object" && "parts" in result && "messageId" in result) return decorateMessage(result)
  return decorateTask(result)
}
