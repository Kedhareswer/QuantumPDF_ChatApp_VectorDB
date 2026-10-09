/**
 * The anydoc conversion step itself — format detection + toMarkdownBytes —
 * shared by the Web Worker (lib/anydoc.worker.ts) and the main-thread fallback
 * in lib/anydoc-client.ts, so both paths behave identically.
 *
 * No DOM, no Node built-ins: this runs in a worker global scope.
 */

export type AnydocModule = typeof import("@firecrawl/anydoc-wasm")

export interface AnydocConversion {
  text: string
  format: string
}

/** An Error that can carry anydoc's ConvertErrorCode (`malformed`, `encrypted`, …). */
export type CodedError = Error & { code?: string }

/** Plain-object form of an error, safe to send through postMessage. */
export interface SerializedError {
  name: string
  message: string
  code?: string
}

let anydoc: Promise<AnydocModule> | null = null

/** Fetch + instantiate the wasm module once per realm; retry cleanly if it fails. */
export function loadAnydoc(): Promise<AnydocModule> {
  anydoc ??= import("@firecrawl/anydoc-wasm")
    .then(async (mod) => {
      await mod.default()
      return mod
    })
    .catch((error: unknown) => {
      anydoc = null
      throw error
    })
  return anydoc
}

/**
 * Detect the format and convert to Markdown. `ext` is the (already
 * TSV-normalised) file extension. Throws on unsupported input; anydoc's own
 * failures throw an Error with a `code`.
 */
export function convertWithAnydoc(mod: AnydocModule, payload: Uint8Array, ext: string): AnydocConversion {
  // Content signature first; the extension is the fallback for signature-less
  // formats (CSV) and containers anydoc does not sniff (legacy .xls).
  const format = mod.formatFromBytes(payload) ?? mod.formatFromExtension(ext)
  if (!format) {
    throw new Error(`Unsupported document format: .${ext || "unknown"}`)
  }
  if (format === "pdf") {
    throw new Error("PDFs are handled by liteparse via /api/pdf/extract, not anydoc")
  }
  return { text: mod.toMarkdownBytes(payload, format), format }
}

export function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    const code = (error as CodedError).code
    return { name: error.name, message: error.message, ...(typeof code === "string" && { code }) }
  }
  return { name: "Error", message: String(error) }
}

export function deserializeError(serialized: SerializedError): CodedError {
  const error: CodedError = new Error(serialized.message)
  error.name = serialized.name
  if (serialized.code !== undefined) error.code = serialized.code
  return error
}

// ---- worker protocol ------------------------------------------------------

export interface AnydocWorkerRequest {
  id: number
  bytes: Uint8Array
  ext: string
}

export type AnydocWorkerResponse =
  | { id: number; ok: true; text: string; format: string }
  /**
   * `stage: "init"` means the wasm module never loaded inside the worker — the
   * client treats that like a crash and falls back to the main thread.
   * `stage: "convert"` is a genuine conversion error and is rethrown as-is.
   */
  | { id: number; ok: false; stage: "init" | "convert"; error: SerializedError }
