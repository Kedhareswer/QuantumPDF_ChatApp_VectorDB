/**
 * The one list of document formats the app accepts, plus the filename parsing
 * that goes with it.
 *
 * This lives in its own module rather than in anydoc-client.ts so that server
 * code (guardrails) and UI code can both import it without pulling in the
 * `"use client"` wasm wrapper.
 */

/** Every non-PDF extension the app accepts. PDFs are handled separately. */
export const SUPPORTED_EXTENSIONS: readonly string[] = [
  "doc", "docx", "docm", "odt", "rtf", "epub",
  "ppt", "pptx", "pps", "odp",
  "xls", "xlsx", "xlsm", "xlsb", "ods",
  "csv", "tsv",
]

/** The extension of a filename, lowercased and without the dot. */
export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".")
  return dot === -1 ? "" : fileName.slice(dot + 1).toLowerCase()
}
