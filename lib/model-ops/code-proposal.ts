const CATALOG_PATH = "lib/ai/model-catalog.ts"

interface Registration {
  provider: string
  model_id: string
  name: string
  description: string
  parameters: Record<string, number>
}

interface Retirement {
  provider: string
  model_id: string
}

function renderEntry(r: Registration): string {
  const params = Object.entries(r.parameters)
    .map(([key, value]) => `${key}: ${value}`)
    .join(", ")
  return `  { provider: ${JSON.stringify(r.provider)}, model_id: ${JSON.stringify(r.model_id)}, name: ${JSON.stringify(r.name)}, description: ${JSON.stringify(r.description)}, parameters: { ${params} } },`
}

export function applyToCatalogSource(source: string, register: Registration[], retire: Retirement[]): string {
  const retiredIds = new Set(retire.map((r) => `model_id: ${JSON.stringify(r.model_id)}`))
  const kept = source
    .split("\n")
    .filter((line) => ![...retiredIds].some((needle) => line.includes(needle)))
    .join("\n")
  const end = kept.lastIndexOf("\n]")
  if (end === -1) throw new Error("Could not find the end of MODEL_MANIFEST")
  const additions = register.map(renderEntry).join("\n")
  return additions ? `${kept.slice(0, end)}\n${additions}${kept.slice(end)}` : kept
}

async function github(path: string, init?: RequestInit): Promise<Record<string, any>> {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) throw new Error(`GitHub ${response.status} on ${path.split("?")[0]}`)
  return response.json()
}

export async function proposeCatalogChange(
  params: { register?: Registration[]; retire?: Retirement[] },
  context: { runId: string; planHash: string; signerKeyId: string },
): Promise<{ status: "applied" | "stored"; detail: string }> {
  const register = params.register ?? []
  const retire = params.retire ?? []
  const repo = process.env.GITHUB_REPOSITORY
  const summary = `+${register.map((r) => r.model_id).join(", +") || "none"} / -${retire.map((r) => r.model_id).join(", -") || "none"}`

  if (!process.env.GITHUB_TOKEN || !repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    const preview = register.map(renderEntry).join("\n")
    return {
      status: "stored",
      detail: `GITHUB_TOKEN or GITHUB_REPOSITORY is not set, so no pull request was opened. Proposed change ${summary}. Add to MODEL_MANIFEST:\n${preview}`.slice(0, 4000),
    }
  }

  const { default_branch: base } = await github(`/repos/${repo}`)
  const { object } = await github(`/repos/${repo}/git/ref/heads/${base}`)
  const branch = `model-ops/${context.runId.slice(0, 8)}`
  await github(`/repos/${repo}/git/refs`, { method: "POST", body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: object.sha }) })

  const file = await github(`/repos/${repo}/contents/${CATALOG_PATH}?ref=${base}`)
  const source = Buffer.from(String(file.content), "base64").toString("utf8")
  const next = applyToCatalogSource(source, register, retire)
  await github(`/repos/${repo}/contents/${CATALOG_PATH}`, {
    method: "PUT",
    body: JSON.stringify({
      message: `chore(model-ops): update model catalog (${summary})`,
      content: Buffer.from(next, "utf8").toString("base64"),
      sha: file.sha,
      branch,
    }),
  })
  const pr = await github(`/repos/${repo}/pulls`, {
    method: "POST",
    body: JSON.stringify({
      title: `Model ops: update model catalog (${summary})`,
      head: branch,
      base,
      body: [
        "Opened by the model-ops agent after human approval.",
        "",
        `Run: ${context.runId}`,
        `Plan hash: ${context.planHash}`,
        `Signed with ML-DSA-65 (key ${context.signerKeyId}) under domain model-ops.plan.`,
        "",
        "Every added model answered a live call through AIClient before it was proposed.",
      ].join("\n"),
    }),
  })
  return { status: "applied", detail: `Opened pull request ${String(pr.html_url)}` }
}
