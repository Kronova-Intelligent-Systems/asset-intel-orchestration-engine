export interface VectorInput {
  id: string
  vector: string | number[] | null
}

export interface AnomalyDetectionOptions {
  method?: string
  threshold?: number
}

export interface AnomalyDetectionResult {
  id: string
  anomaly_score: number
  is_anomaly: boolean
  anomaly_type: string
  explanation: string
  threshold: number
}

type Method = "isolation-forest" | "local-outlier-factor" | "one-class-svm"

const MIN_POINTS = 5
const MAX_LOF_POINTS = 1500
const FOREST_TREES = 100
const FOREST_SAMPLE_SIZE = 256
const LOF_NEIGHBORS = 20
const EULER_GAMMA = 0.5772156649

function parseVector(value: string | number[] | null): number[] | null {
  if (!value) return null
  try {
    const parsed: unknown = typeof value === "string" ? JSON.parse(value) : value
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    const numbers = parsed.map(Number)
    return numbers.every(Number.isFinite) ? numbers : null
  } catch {
    return null
  }
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function euclidean(a: number[], b: number[]): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i]
    sum += diff * diff
  }
  return Math.sqrt(sum)
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

// Average path length of an unsuccessful search in a binary search tree.
function averagePathLength(n: number): number {
  if (n <= 1) return 0
  if (n === 2) return 1
  return 2 * (Math.log(n - 1) + EULER_GAMMA) - (2 * (n - 1)) / n
}

type IsolationNode = { leafSize: number } | { feature: number; split: number; left: IsolationNode; right: IsolationNode }

function buildIsolationTree(
  points: number[][],
  indices: number[],
  depth: number,
  maxDepth: number,
  random: () => number,
): IsolationNode {
  if (depth >= maxDepth || indices.length <= 1) return { leafSize: indices.length }

  const dims = points[0].length
  for (let attempt = 0; attempt < 10; attempt++) {
    const feature = Math.floor(random() * dims)
    let min = Infinity
    let max = -Infinity
    for (const index of indices) {
      const value = points[index][feature]
      if (value < min) min = value
      if (value > max) max = value
    }
    if (max <= min) continue

    const split = min + random() * (max - min)
    const left: number[] = []
    const right: number[] = []
    for (const index of indices) {
      ;(points[index][feature] < split ? left : right).push(index)
    }
    if (left.length === 0 || right.length === 0) continue

    return {
      feature,
      split,
      left: buildIsolationTree(points, left, depth + 1, maxDepth, random),
      right: buildIsolationTree(points, right, depth + 1, maxDepth, random),
    }
  }
  return { leafSize: indices.length }
}

function isolationPathLength(point: number[], node: IsolationNode, depth: number): number {
  if ("leafSize" in node) return depth + averagePathLength(node.leafSize)
  return isolationPathLength(point, point[node.feature] < node.split ? node.left : node.right, depth + 1)
}

function isolationForestScores(points: number[][]): number[] {
  const random = seededRandom(42)
  const sampleSize = Math.min(FOREST_SAMPLE_SIZE, points.length)
  const maxDepth = Math.ceil(Math.log2(sampleSize))
  const pathSums = new Float64Array(points.length)

  for (let tree = 0; tree < FOREST_TREES; tree++) {
    const order = points.map((_, index) => index)
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      ;[order[i], order[j]] = [order[j], order[i]]
    }
    const root = buildIsolationTree(points, order.slice(0, sampleSize), 0, maxDepth, random)
    for (let i = 0; i < points.length; i++) {
      pathSums[i] += isolationPathLength(points[i], root, 0)
    }
  }

  const normalizer = averagePathLength(sampleSize) || 1
  return Array.from(pathSums, (sum) => Math.pow(2, -(sum / FOREST_TREES) / normalizer))
}

function localOutlierFactorScores(points: number[][]): number[] {
  const n = points.length
  const k = Math.min(LOF_NEIGHBORS, n - 1)
  const distances: Float32Array[] = Array.from({ length: n }, () => new Float32Array(n))
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = euclidean(points[i], points[j])
      distances[i][j] = d
      distances[j][i] = d
    }
  }

  const neighbors: number[][] = []
  const kDistance = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const order = Array.from({ length: n }, (_, j) => j)
      .filter((j) => j !== i)
      .sort((a, b) => distances[i][a] - distances[i][b])
      .slice(0, k)
    neighbors.push(order)
    kDistance[i] = distances[i][order[order.length - 1]]
  }

  const epsilon = 1e-12
  const density = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    let reachSum = 0
    for (const o of neighbors[i]) reachSum += Math.max(kDistance[o], distances[i][o])
    density[i] = 1 / (reachSum / k + epsilon)
  }

  return Array.from({ length: n }, (_, i) => {
    let neighborDensity = 0
    for (const o of neighbors[i]) neighborDensity += density[o]
    return neighborDensity / k / density[i]
  })
}

function centroidDistanceScores(points: number[][]): number[] {
  const dims = points[0].length
  const centroid = new Array<number>(dims).fill(0)
  for (const point of points) {
    for (let d = 0; d < dims; d++) centroid[d] += point[d] / points.length
  }
  return points.map((point) => euclidean(point, centroid))
}

// Maps raw scores to 0..1 using a robust z-score so one threshold works across methods.
function normalizeScores(raw: number[]): number[] {
  const center = median(raw)
  const mad = median(raw.map((value) => Math.abs(value - center)))
  const mean = raw.reduce((sum, value) => sum + value, 0) / raw.length
  const std = Math.sqrt(raw.reduce((sum, value) => sum + (value - mean) ** 2, 0) / raw.length)
  const scale = mad > 0 ? mad * 1.4826 : std
  if (scale <= 0) return raw.map(() => 0)
  return raw.map((value) => 1 - Math.exp(-Math.max(0, (value - center) / scale) / 3))
}

function resolveMethod(method: string | undefined, pointCount: number): { method: Method; note: string } {
  const requested: Method =
    method === "local-outlier-factor" || method === "one-class-svm" ? method : "isolation-forest"
  if (requested === "local-outlier-factor" && pointCount > MAX_LOF_POINTS) {
    return {
      method: "isolation-forest",
      note: ` Local Outlier Factor is limited to ${MAX_LOF_POINTS} embeddings, so Isolation Forest was used.`,
    }
  }
  if (requested === "one-class-svm") {
    return {
      method: requested,
      note: " One-Class SVM is approximated by distance from the embedding centroid.",
    }
  }
  return { method: requested, note: "" }
}

const ANOMALY_TYPES: Record<Method, string> = {
  "isolation-forest": "Easily isolated pattern",
  "local-outlier-factor": "Low-density outlier",
  "one-class-svm": "Distant from typical shipments",
}

export class AnomalyDetectionSystem {
  async detectAnomalies(
    inputs: VectorInput[],
    options: AnomalyDetectionOptions = {},
  ): Promise<AnomalyDetectionResult[]> {
    const threshold = options.threshold ?? 0.8
    const parsed = inputs
      .map((input) => ({ id: input.id, vector: parseVector(input.vector) }))
      .filter((item): item is { id: string; vector: number[] } => item.vector !== null)

    const dimension = parsed[0]?.vector.length
    const valid = parsed.filter((item) => item.vector.length === dimension)

    if (valid.length < MIN_POINTS) {
      return valid.map((item) => ({
        id: item.id,
        anomaly_score: 0,
        is_anomaly: false,
        anomaly_type: "Insufficient data",
        explanation: `At least ${MIN_POINTS} embeddings are needed to detect anomalies; found ${valid.length}.`,
        threshold,
      }))
    }

    const points = valid.map((item) => item.vector)
    const { method, note } = resolveMethod(options.method, points.length)

    let raw: number[]
    if (method === "local-outlier-factor") raw = localOutlierFactorScores(points)
    else if (method === "one-class-svm") raw = centroidDistanceScores(points)
    else raw = isolationForestScores(points)

    const scores = normalizeScores(raw)

    return valid.map((item, index) => {
      const score = scores[index]
      const isAnomaly = score >= threshold
      return {
        id: item.id,
        anomaly_score: score,
        is_anomaly: isAnomaly,
        anomaly_type: isAnomaly ? ANOMALY_TYPES[method] : "Normal",
        explanation: isAnomaly
          ? `Scored ${(score * 100).toFixed(0)}% against a ${(threshold * 100).toFixed(0)}% threshold compared with ${points.length} other shipments.${note}`
          : `Within the normal range at ${(score * 100).toFixed(0)}%.${note}`,
        threshold,
      }
    })
  }
}
