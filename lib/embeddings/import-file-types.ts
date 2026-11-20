export const PLAIN_TEXT_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "csv",
  "tsv",
  "json",
  "jsonl",
  "log",
  "xml",
  "html",
  "htm",
  "yaml",
  "yml",
])

export const SUPPORTED_IMPORT_EXTENSIONS = [".pdf", ...[...PLAIN_TEXT_EXTENSIONS].map((extension) => `.${extension}`)]
