"use client"

/**
 * Client-side PDF orchestrator.
 *
 * Text + OCR + page previews come from the server-side liteparse route
 * (/api/pdf/extract). Embedded images, tables, and equations are still
 * extracted client-side via PDF.js (the existing extractors), preserving the
 * multimodal panels. The result keeps the PDFProcessingResult shape the UI and
 * RAG pipeline already consume.
 */
import type { ExtractedImage, MultimodalMetadata } from "@/types/multimodal-types"
import type { TextChunk } from "./advanced-chunking"
import { EquationExtractor } from "./equation-extractor"
import { PDFImageExtractor } from "./image-extractor"
import { loadPdfJs } from "./pdf-client"
import { PDFTableExtractor } from "./table-extractor"
import { logger } from "./logger"

export interface ProcessingProgress {
  stage: string
  progress: number
  details?: string
  method?: string
  currentPage?: number
  totalPages?: number
}

export interface PDFProcessingResult {
  text: string
  chunks: string[]
  advancedChunks?: TextChunk[]
  metadata: {
    documentType: "pdf"
    title?: string
    pages: number
    processingMethod: string
    extractionQuality: "high" | "medium" | "low"
    fileSize: number
    processingTime: number
    successfulPages: number
    failedPages: number
    confidence: number
    warnings: string[]
    ocrUsed?: boolean
    ocrConfidence?: number
    multimodal?: MultimodalMetadata
  }
}

export interface PDFProcessorRunOptions {
  enableOCR?: boolean
  ocrLanguage?: string
}

interface RouteResponse {
  success: boolean
  text?: string
  chunks?: string[]
  advancedChunks?: TextChunk[]
  error?: string
  metadata?: {
    pages?: number
    successfulPages?: number
    failedPages?: number
    processingMethod?: string
    extractionQuality?: "high" | "medium" | "low" | "none"
    ocrUsed?: boolean
    confidence?: number
    warnings?: string[]
    previews?: ExtractedImage[]
  }
}

export class PdfDocumentProcessor {
  private aborted = false
  private imageExtractor: PDFImageExtractor | null = null
  private tableExtractor: PDFTableExtractor | null = null
  private equationExtractor: EquationExtractor | null = null

  abort(): void {
    this.aborted = true
  }

  async processFile(
    file: File,
    onProgress?: (progress: ProcessingProgress) => void,
    runOptions?: PDFProcessorRunOptions,
  ): Promise<PDFProcessingResult> {
    this.aborted = false
    const startTime = Date.now()
    const documentId = `${Date.now()}-${file.name}`

    onProgress?.({ stage: "Parsing document with liteparse...", progress: 10, method: "liteparse" })

    const route = await this.extractViaRoute(file, !!runOptions?.enableOCR)
    if (!route.success || !route.text) {
      throw new Error(route.error || "liteparse extraction returned no text")
    }

    const meta = route.metadata ?? {}
    const text = route.text
    const chunks = route.chunks && route.chunks.length > 0 ? route.chunks : [text]
    const warnings = [...(meta.warnings ?? [])]
    const previews = meta.previews ?? []

    onProgress?.({
      stage: "Extracting images, tables & equations...",
      progress: 55,
      method: "Multimodal Extraction",
    })

    let multimodal: MultimodalMetadata
    try {
      multimodal = await this.extractMultimodal(file, documentId, previews, onProgress)
    } catch (error) {
      logger.warn("Multimodal extraction failed; continuing with text only:", error)
      warnings.push("Multimodal extraction failed; text is still available")
      multimodal = {
        images: previews,
        tables: [],
        equations: [],
        charts: [],
        summary: { imageCount: previews.length, tableCount: 0, equationCount: 0, chartCount: 0 },
      }
    }

    onProgress?.({ stage: "Finalizing...", progress: 95, method: meta.processingMethod })

    const quality = meta.extractionQuality && meta.extractionQuality !== "none" ? meta.extractionQuality : "low"

    return {
      text,
      chunks,
      advancedChunks: route.advancedChunks,
      metadata: {
        documentType: "pdf",
        title: file.name,
        pages: meta.pages ?? 0,
        processingMethod: meta.processingMethod ?? "liteparse",
        extractionQuality: quality,
        fileSize: file.size,
        processingTime: Date.now() - startTime,
        successfulPages: meta.successfulPages ?? meta.pages ?? 0,
        failedPages: meta.failedPages ?? 0,
        confidence: meta.confidence ?? 90,
        warnings,
        ocrUsed: meta.ocrUsed ?? false,
        multimodal,
      },
    }
  }

  private async extractViaRoute(file: File, enableOCR: boolean): Promise<RouteResponse> {
    const form = new FormData()
    form.append("file", file)
    form.append("enableOCR", String(enableOCR))

    const response = await fetch("/api/pdf/extract", { method: "POST", body: form })
    const data = (await response.json().catch(() => null)) as RouteResponse | null

    if (!data) {
      return { success: false, error: `Extraction failed (HTTP ${response.status})` }
    }
    return data
  }

  private async extractMultimodal(
    file: File,
    documentId: string,
    previews: ExtractedImage[],
    onProgress?: (progress: ProcessingProgress) => void,
  ): Promise<MultimodalMetadata> {
    const pdfjs = await loadPdfJs()
    if (!pdfjs) {
      // PDF.js unavailable (e.g. SSR) — return liteparse previews only.
      return {
        images: previews,
        tables: [],
        equations: [],
        charts: [],
        summary: { imageCount: previews.length, tableCount: 0, equationCount: 0, chartCount: 0 },
      }
    }

    const buffer = await file.arrayBuffer()
    const pdf = await pdfjs.getDocument({
      data: new Uint8Array(buffer),
      disableWorker: true,
      isEvalSupported: false,
      useSystemFonts: true,
      stopAtErrors: false,
      verbosity: 0,
    }).promise

    try {
      if (!this.imageExtractor) {
        this.imageExtractor = new PDFImageExtractor({ maxPages: 3, quality: 0.85, scale: 1.4 })
      }
      if (!this.tableExtractor) this.tableExtractor = new PDFTableExtractor()
      if (!this.equationExtractor) this.equationExtractor = new EquationExtractor()

      const inline = await this.imageExtractor.extractInlineImages(
        pdf,
        documentId,
        { maxImages: 20, minWidth: 64, minHeight: 64, quality: 0.8 },
        (p) =>
          onProgress?.({
            stage: p.stage,
            progress: 60 + (p.processed / Math.max(p.total || 1, 1)) * 10,
            method: "Inline Image Extraction",
            currentPage: p.pageNumber,
            totalPages: p.total,
          }),
      )

      const tableResult = await this.tableExtractor.extractTablesFromText(
        pdf,
        documentId,
        { maxTables: 10, minRows: 2, minColumns: 2 },
        (p) =>
          onProgress?.({
            stage: p.stage,
            progress: 75 + (p.processed / Math.max(p.total || 1, 1)) * 5,
            method: "Table Extraction",
            currentPage: p.pageNumber,
            totalPages: p.total,
          }),
      )

      const equationResult = await this.equationExtractor.extractFromPDF(
        pdf,
        documentId,
        { maxEquations: 30, detectInline: true, detectBlock: true },
        (p) =>
          onProgress?.({
            stage: p.stage,
            progress: 85 + (p.processed / Math.max(p.total || 1, 1)) * 5,
            method: "Equation Extraction",
            currentPage: p.pageNumber,
            totalPages: p.total,
          }),
      )

      const images = [...previews, ...inline.images]
      return {
        images,
        tables: tableResult.tables,
        equations: equationResult.equations,
        charts: [],
        summary: {
          imageCount: images.length,
          tableCount: tableResult.tables.length,
          equationCount: equationResult.equations.length,
          chartCount: 0,
        },
      }
    } finally {
      try {
        await pdf.destroy()
      } catch {
        /* ignore cleanup errors */
      }
    }
  }
}
