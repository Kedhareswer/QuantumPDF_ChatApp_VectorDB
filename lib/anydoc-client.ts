"use client"

/**
 * In-browser document extraction via @firecrawl/anydoc-wasm (Rust -> WebAssembly, MIT).
 *
 * Covers every non-PDF format: Word, PowerPoint, Excel, OpenDocument, RTF,
 * EPUB and CSV -> GitHub-Flavored Markdown. PDFs stay on liteparse
 * (see liteparse-client.ts) because anydoc has no OCR and no page previews.
 *
 * Running in the browser means document bytes never leave the machine, and
 * there is no serverless function, no native .node binary and no per-platform
 * install to keep alive. The wasm module is ~6MB, so the page warms it in the
 * background on load via prefetchAnydoc() — by the time anyone picks a file it
 * is usually already compiled.
 *
 * Conversion is synchronous and single-threaded: a large spreadsheet blocks the
 * main thread. ponytail: move the call into a Worker if that becomes visible.
 */
import {
  assessExtractionQuality,
  buildChunks,
  type ExtractionQuality,
  type TextChunk,
} from "./advanced-chunking"

import { extensionOf } from "./supported-formats"

export interface DocumentExtraction {
  text: string
  chunks: string[]
  advancedChunks: TextChunk[]
  format: string
  wordCount: number
  paragraphCount: number
  extractionQuality: ExtractionQuality
  warnings: string[]
}

export interface DocumentExtractionOptions {
  fileName: string
  documentId?: string
}

// ponytail: one flat guard against a pathological document (a million-row
// sheet would otherwise become thousands of embedding calls). Raise it, or
// swap for a per-format row cap, if real documents start hitting it.
const MAX_MARKDOWN_CHARS = 1_000_000

type Anydoc = typeof import("@firecrawl/anydoc-wasm")

let anydoc: Promise<Anydoc> | null = null

/** Fetch + instantiate the wasm module once; retry cleanly if it fails. */
function loadAnydoc(): Promise<Anydoc> {
  anydoc ??= import("@firecrawl/anydoc-wasm")
    .then(async (mod) => {
      await mod.default()
      return mod
    })
    .catch((error) => {
      anydoc = null
      throw error
    })
  return anydoc
}

/**
 * Warm the wasm module in the background so the first upload doesn't sit
 * through a ~6MB fetch. Fire-and-forget, and safe to call more than once:
 * loadAnydoc() memoizes, so an extraction that starts mid-prefetch awaits the
 * same promise instead of fetching again.
 *
 * The scheduling lives here rather than at the call site: this module is the
 * one that knows the payload is large, so every caller gets the same deferral
 * and the same SSR guard for free.
 *
 * Failures are swallowed — loadAnydoc() drops its cache on failure, so the
 * first real extraction retries and reports the error where a user can see it.
 */
export function prefetchAnydoc(): void {
  if (typeof window === "undefined") return
  const warm = () => loadAnydoc().catch(() => {})
  // Wait for main-thread idle so the download doesn't land in the middle of
  // hydration; setTimeout is the fallback where requestIdleCallback is absent.
  if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(warm)
  else window.setTimeout(warm, 200)
}

/**
 * TSV has no byte signature and anydoc has no TSV format, so re-emit it as
 * well-formed CSV. The papaparse round-trip handles quoting — a field
 * containing a comma survives the delimiter change.
 */
async function tsvToCsv(bytes: Uint8Array): Promise<Uint8Array> {
  const Papa = (await import("papaparse")).default
  const text = new TextDecoder().decode(bytes)
  const parsed = Papa.parse<string[]>(text.trim(), { delimiter: "\t" })
  return new TextEncoder().encode(Papa.unparse(parsed.data))
}

/**
 * Convert a document to Markdown, then chunk it for the RAG pipeline.
 * Throws on an unsupported or unparseable file — the caller surfaces the
 * error rather than indexing a "processing failed" report as if it were the
 * document.
 */
export async function extractDocument(
  bytes: Uint8Array,
  options: DocumentExtractionOptions,
): Promise<DocumentExtraction> {
  const { formatFromBytes, formatFromExtension, toMarkdownBytes } = await loadAnydoc()

  const ext = extensionOf(options.fileName)
  const warnings: string[] = []

  let payload = bytes
  if (ext === "tsv") {
    payload = await tsvToCsv(bytes)
  }

  // Content signature first; the extension is the fallback for signature-less
  // formats (CSV) and containers anydoc does not sniff (legacy .xls).
  const format = formatFromBytes(payload) ?? formatFromExtension(ext === "tsv" ? "csv" : ext)
  if (!format) {
    throw new Error(`Unsupported document format: .${ext || "unknown"}`)
  }
  if (format === "pdf") {
    throw new Error("PDFs are handled by liteparse via /api/pdf/extract, not anydoc")
  }

  let text = toMarkdownBytes(payload, format).trim()
  if (!text) {
    throw new Error(`No text content could be extracted from this ${format.toUpperCase()} file`)
  }

  if (text.length > MAX_MARKDOWN_CHARS) {
    text = text.slice(0, MAX_MARKDOWN_CHARS)
    warnings.push(
      `Document truncated to ${MAX_MARKDOWN_CHARS.toLocaleString()} characters; the tail was not indexed`,
    )
  }

  const { advancedChunks, chunks } = buildChunks(text, options.fileName, options.documentId)

  return {
    text,
    chunks,
    advancedChunks,
    format,
    wordCount: text.split(/\s+/).filter(Boolean).length,
    paragraphCount: text.split(/\n\n+/).filter((p) => p.trim().length > 0).length,
    extractionQuality: assessExtractionQuality(text),
    warnings,
  }
}
