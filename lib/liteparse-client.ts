/**
 * Server-only PDF extraction via @llamaindex/liteparse (native Rust + PDFium),
 * with a PDF.js text fallback.
 *
 * IMPORTANT: this module is server-only. The native @llamaindex/liteparse addon
 * is imported LAZILY (a dynamic import inside extractPdf) so it is never loaded
 * during `next build` page-data collection — only at request time — and a native
 * load failure degrades gracefully to the PDF.js fallback below.
 */
import { AdvancedChunker, type TextChunk } from "./advanced-chunking"
import { logger } from "./logger"
import type { ExtractedImage } from "@/types/multimodal-types"

const CHUNK_OPTIONS = {
  maxChunkSize: 1000,
  minChunkSize: 250,
  overlap: 100,
  preserveStructure: true,
  semanticSplitting: true,
  documentAware: true,
  adaptiveThreshold: true,
}

export interface PdfExtractionOptions {
  enableOCR?: boolean
  ocrLanguage?: string
  capturePreviews?: boolean
  maxPreviewPages?: number
  fileName?: string
  documentId?: string
}

export interface PdfExtraction {
  text: string
  chunks: string[]
  advancedChunks: TextChunk[]
  pages: number
  ocrUsed: boolean
  previews: ExtractedImage[]
  processingMethod: "liteparse" | "pdfjs-fallback"
  extractionQuality: "high" | "medium" | "low" | "none"
  warnings: string[]
}

function newId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function buildChunks(text: string, fileName?: string, documentId?: string) {
  const advancedChunks = new AdvancedChunker(CHUNK_OPTIONS).chunkText(text, documentId, fileName)
  const chunks = advancedChunks.map((c) => c.content).filter((c) => c.trim().length > 0)
  return { advancedChunks, chunks }
}

function assessQuality(text: string): PdfExtraction["extractionQuality"] {
  if (!text) return "none"
  if (text.length > 500) return "high"
  if (text.length > 100) return "medium"
  return "low"
}

/**
 * Serverless-safe text fallback used when liteparse fails or finds no text.
 * Uses unpdf (a pdfjs build configured for Node/edge runtimes) so it works in
 * serverless functions where raw pdfjs-dist throws "DOMMatrix is not defined".
 */
async function extractTextFallback(buffer: Buffer): Promise<{ text: string; pages: number }> {
  const { extractText, getDocumentProxy } = await import("unpdf")
  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  const { totalPages, text } = await extractText(pdf, { mergePages: true })
  const merged = (Array.isArray(text) ? text.join("\n\n") : text)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
  return { text: merged, pages: totalPages }
}

/**
 * Extract text, chunks, and page previews from a PDF using liteparse, falling
 * back to PDF.js text extraction on failure.
 */
export async function extractPdf(
  bytes: Uint8Array,
  options: PdfExtractionOptions = {},
): Promise<PdfExtraction> {
  const buffer = Buffer.from(bytes)
  const documentId = options.documentId ?? newId()
  const warnings: string[] = []

  // Primary engine: liteparse (native). The lazy dynamic import keeps the native
  // addon out of `next build` page-data collection; a load failure is caught
  // below and falls back to PDF.js.
  try {
    const { LiteParse } = await import("@llamaindex/liteparse")
    const parser = new LiteParse({
      ocrEnabled: !!options.enableOCR,
      ocrLanguage: options.ocrLanguage ?? "eng",
      quiet: true,
    })
    const result = await parser.parse(buffer)
    const text = (result.text ?? "").trim()

    if (text) {
      const { advancedChunks, chunks } = buildChunks(text, options.fileName, documentId)
      const ocrUsed =
        !!options.enableOCR &&
        result.pages.some((page) => page.textItems.some((item) => typeof item.confidence === "number"))

      let previews: ExtractedImage[] = []
      if (options.capturePreviews !== false) {
        try {
          const max = options.maxPreviewPages ?? 3
          const pageNums = result.pages.slice(0, max).map((page) => page.pageNum)
          const shots = await parser.screenshot(buffer, pageNums)
          previews = shots.map((shot) => ({
            id: `${documentId}-preview-${shot.pageNum}`,
            documentId,
            pageNumber: shot.pageNum,
            dataUrl: `data:image/png;base64,${shot.imageBuffer.toString("base64")}`,
            mimeType: "image/png",
            width: shot.width,
            height: shot.height,
            type: "page-preview",
            source: "pdf",
            extractedAt: new Date(),
          }))
        } catch (error) {
          warnings.push("Page previews unavailable")
          logger.warn("liteparse screenshot failed:", error)
        }
      }

      return {
        text,
        chunks,
        advancedChunks,
        pages: result.pages.length,
        ocrUsed,
        previews,
        processingMethod: "liteparse",
        extractionQuality: assessQuality(text),
        warnings,
      }
    }
    warnings.push("liteparse found no extractable text; using unpdf fallback")
  } catch (error) {
    warnings.push(
      `liteparse failed (${error instanceof Error ? error.message : "unknown error"}); using unpdf fallback`,
    )
    logger.error("liteparse native parse unavailable; falling back to unpdf:", error)
  }

  // Fallback engine: serverless-safe text extraction via unpdf.
  const { text, pages } = await extractTextFallback(buffer)
  const { advancedChunks, chunks } = buildChunks(text, options.fileName, documentId)
  return {
    text,
    chunks,
    advancedChunks,
    pages,
    ocrUsed: false,
    previews: [],
    processingMethod: "pdfjs-fallback",
    extractionQuality: assessQuality(text),
    warnings,
  }
}
