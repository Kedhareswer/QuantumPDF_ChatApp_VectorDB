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
 * Conversion itself (anydoc's toMarkdownBytes) is synchronous and would block
 * the main thread on a large spreadsheet, so it runs in a Web Worker
 * (lib/anydoc.worker.ts). Where Worker is unavailable (SSR, jsdom) or the
 * worker fails to start or crashes, the same conversion runs on the main
 * thread instead. TSV->CSV and chunking stay here: both are cheap.
 */
import {
  assessExtractionQuality,
  buildChunks,
  type ExtractionQuality,
  type TextChunk,
} from "./advanced-chunking"
import {
  convertWithAnydoc,
  deserializeError,
  loadAnydoc,
  type AnydocConversion,
  type AnydocWorkerRequest,
  type AnydocWorkerResponse,
} from "./anydoc-convert"
import { logger } from "./logger"
import { extensionOf } from "./supported-formats"

export interface DocumentExtraction {
  text: string
  chunks: string[]
  advancedChunks: TextChunk[]
  /**
   * For each entry of `chunks`, the nearest Markdown heading at or before it:
   * the sheet name for spreadsheets (anydoc emits `## <sheet>`), the heading
   * for Word/ODT/EPUB. null when the chunk precedes every heading.
   */
  chunkSections: Array<string | null>
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

// ---- worker ---------------------------------------------------------------

/** The worker could not do the job (failed to start, crashed, wasm init failed): fall back. */
class WorkerUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "WorkerUnavailableError"
  }
}

interface PendingRequest {
  resolve: (conversion: AnydocConversion) => void
  reject: (error: Error) => void
}

// After this many consecutive failures stop spawning workers for the session;
// every call then goes straight to the main-thread path.
const MAX_WORKER_FAILURES = 3

let worker: Worker | null = null
let workerFailures = 0
let nextRequestId = 0
const pending = new Map<number, PendingRequest>()

/** Tear down a broken worker, reject what it was holding, and let the next call respawn. */
function failWorker(target: Worker, reason: string): void {
  if (worker !== target) return
  worker = null
  workerFailures++
  target.terminate()
  const error = new WorkerUnavailableError(reason)
  for (const request of pending.values()) request.reject(error)
  pending.clear()
}

function handleWorkerMessage(event: MessageEvent<AnydocWorkerResponse>): void {
  const response = event.data
  const request = pending.get(response.id)
  if (!request) return
  pending.delete(response.id)
  if (response.ok) {
    workerFailures = 0
    request.resolve({ text: response.text, format: response.format })
  } else if (response.stage === "init") {
    workerFailures++
    request.reject(new WorkerUnavailableError(`anydoc wasm failed to load in the worker: ${response.error.message}`))
  } else {
    request.reject(deserializeError(response.error))
  }
}

/** The shared worker, spawned on first use; null when workers are unavailable. */
function getWorker(): Worker | null {
  if (worker) return worker
  if (typeof Worker === "undefined" || workerFailures >= MAX_WORKER_FAILURES) return null
  let created: Worker
  try {
    // Keep this expression literal: Turbopack recognises the
    // `new Worker(new URL(..., import.meta.url))` shape and emits the worker
    // (and the wasm it imports) as its own chunk.
    created = new Worker(new URL("./anydoc.worker.ts", import.meta.url), { type: "module" })
  } catch (error) {
    workerFailures++
    logger.warn("anydoc worker failed to start; converting on the main thread:", error)
    return null
  }
  created.addEventListener("message", handleWorkerMessage)
  created.addEventListener("error", (event: ErrorEvent) => {
    event.preventDefault()
    failWorker(created, `anydoc worker crashed: ${event.message || "failed to load"}`)
  })
  created.addEventListener("messageerror", () => failWorker(created, "anydoc worker sent an unreadable message"))
  worker = created
  return created
}

function convertInWorker(target: Worker, payload: Uint8Array, ext: string): Promise<AnydocConversion> {
  return new Promise((resolve, reject) => {
    const id = ++nextRequestId
    pending.set(id, { resolve, reject })
    // Structured clone copies the whole underlying buffer, so trim a view first.
    const bytes =
      payload.byteOffset === 0 && payload.byteLength === payload.buffer.byteLength ? payload : payload.slice()
    const request: AnydocWorkerRequest = { id, bytes, ext }
    try {
      target.postMessage(request)
    } catch (error) {
      pending.delete(id)
      failWorker(target, `could not post to anydoc worker: ${String(error)}`)
      reject(new WorkerUnavailableError(String(error)))
    }
  })
}

async function convertOnMainThread(payload: Uint8Array, ext: string): Promise<AnydocConversion> {
  return convertWithAnydoc(await loadAnydoc(), payload, ext)
}

/** Worker first; main thread when there is no worker or it gave out mid-request. */
async function convert(payload: Uint8Array, ext: string): Promise<AnydocConversion> {
  const target = getWorker()
  if (!target) return convertOnMainThread(payload, ext)
  try {
    return await convertInWorker(target, payload, ext)
  } catch (error) {
    if (!(error instanceof WorkerUnavailableError)) throw error
    logger.warn(`${error.message}; converting on the main thread`)
    return convertOnMainThread(payload, ext)
  }
}

/**
 * Warm the converter in the background so the first upload doesn't sit
 * through a ~6MB fetch: spawn the worker (which starts loading the wasm as it
 * boots), or load the wasm on the main thread where there are no workers.
 * Fire-and-forget and safe to call more than once — both are memoized, so an
 * extraction that starts mid-prefetch reuses the same worker / promise.
 *
 * The scheduling lives here rather than at the call site: this module is the
 * one that knows the payload is large, so every caller gets the same deferral
 * and the same SSR guard for free.
 *
 * Failures are swallowed — the first real extraction retries and reports the
 * error where a user can see it.
 */
export function prefetchAnydoc(): void {
  if (typeof window === "undefined") return
  const warm = () => {
    if (!getWorker()) loadAnydoc().catch(() => {})
  }
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
  const ext = extensionOf(options.fileName)
  const warnings: string[] = []

  let payload = bytes
  if (ext === "tsv") {
    payload = await tsvToCsv(bytes)
  }

  const conversion = await convert(payload, ext === "tsv" ? "csv" : ext)
  const format = conversion.format
  let text = conversion.text.trim()
  if (!text) {
    throw new Error(`No text content could be extracted from this ${format.toUpperCase()} file`)
  }

  if (text.length > MAX_MARKDOWN_CHARS) {
    text = text.slice(0, MAX_MARKDOWN_CHARS)
    warnings.push(
      `Document truncated to ${MAX_MARKDOWN_CHARS.toLocaleString()} characters; the tail was not indexed`,
    )
  }

  const { advancedChunks, chunks, chunkSections } = buildChunks(
    text,
    options.fileName,
    options.documentId,
    undefined,
    { sections: true },
  )

  return {
    text,
    chunks,
    advancedChunks,
    chunkSections: chunkSections ?? chunks.map(() => null),
    format,
    wordCount: text.split(/\s+/).filter(Boolean).length,
    paragraphCount: text.split(/\n\n+/).filter((p) => p.trim().length > 0).length,
    extractionQuality: assessExtractionQuality(text),
    warnings,
  }
}
