export interface TextChunk {
  content: string
  start: number
  end: number
}

export interface ChunkOptions {
  chunkSize: number
  chunkOverlap: number
}

const MIN_CHUNK_SIZE = 200

/**
 * Splits text into overlapping chunks, preferring paragraph, then sentence, then word boundaries.
 * Every iteration advances the window, so any size/overlap combination terminates.
 */
export function chunkText(text: string, options: ChunkOptions): TextChunk[] {
  const size = Math.max(MIN_CHUNK_SIZE, Math.floor(options.chunkSize) || MIN_CHUNK_SIZE)
  const overlap = Math.min(Math.max(0, Math.floor(options.chunkOverlap) || 0), Math.floor(size / 2))
  const minimumEnd = Math.floor(size * 0.6)
  const chunks: TextChunk[] = []

  let start = 0
  while (start < text.length) {
    let end = Math.min(start + size, text.length)

    if (end < text.length) {
      const windowStart = start + minimumEnd
      const window = text.slice(windowStart, end)
      let cut = -1

      const paragraph = window.lastIndexOf("\n\n")
      if (paragraph >= 0) {
        cut = windowStart + paragraph + 2
      } else {
        const sentences = [...window.matchAll(/[.!?]["')\]]?\s/g)]
        const lastSentence = sentences[sentences.length - 1]
        if (lastSentence?.index !== undefined) {
          cut = windowStart + lastSentence.index + lastSentence[0].length
        } else {
          const space = window.lastIndexOf(" ")
          if (space >= 0) cut = windowStart + space + 1
        }
      }

      if (cut > start) end = cut
    }

    const content = text.slice(start, end).trim()
    if (content) chunks.push({ content, start, end })

    if (end >= text.length) break
    start = Math.max(end - overlap, start + 1)
  }

  return chunks
}
