import { extractText, getDocumentProxy } from "unpdf"
import { PLAIN_TEXT_EXTENSIONS } from "./import-file-types"

function normalize(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/** Returns readable text for a supported file, or throws a message explaining why it can't be read. */
export async function extractTextFromFile(file: File): Promise<string> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? ""

  if (extension === "pdf" || file.type === "application/pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()))
    const { text } = await extractText(pdf, { mergePages: true })
    return normalize(text)
  }

  if (PLAIN_TEXT_EXTENSIONS.has(extension) || file.type.startsWith("text/") || file.type === "application/json") {
    return normalize(await file.text())
  }

  throw new Error(
    `unsupported file type. Supported types: PDF, ${[...PLAIN_TEXT_EXTENSIONS].join(", ")}. Export Word and Excel files as PDF, TXT or CSV first.`,
  )
}
