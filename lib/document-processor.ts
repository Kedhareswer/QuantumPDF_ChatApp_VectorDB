"use client"

/**
 * Client-side orchestrator for every non-PDF document.
 *
 * Text comes from anydoc's wasm build, running in this tab — Word,
 * PowerPoint, Excel, OpenDocument, RTF, EPUB and CSV/TSV. For Word files we
 * additionally run the existing client-side image extractor so the multimodal
 * panel keeps working. PDFs go through PdfDocumentProcessor.
 */
import type { MultimodalMetadata } from "@/types/multimodal-types"
import type { TextChunk } from "./advanced-chunking"
import { extractDocument } from "./anydoc-client"
import { extensionOf } from "./supported-formats"
import { DOCXImageExtractor } from "./image-extractor"
import { logger } from "./logger"

// One progress shape across both pipelines — unified-pdf-processor.tsx feeds
// this processor's callback into the PDF one's type, so they must not diverge.
import type { ProcessingProgress } from "./pdf-document-processor"
export type { ProcessingProgress }

export interface DocumentProcessingResult {
  text: string
  chunks: string[]
  advancedChunks?: TextChunk[]
  metadata: {
    documentType: string
    title: string
    format: string
    processingMethod: string
    extractionQuality: "high" | "medium" | "low"
    fileSize: number
    processingTime: number
    warnings: string[]
    wordCount: number
    paragraphCount: number
    hasImages: boolean
    multimodal?: MultimodalMetadata
  }
}

/** Word containers the DOCX image extractor can read (it unzips word/media). */
const ZIP_WORD_EXTENSIONS = ["docx", "docm"]

export class DocumentProcessor {
  private aborted = false

  abort(): void {
    this.aborted = true
  }

  async processFile(
    file: File,
    onProgress?: (progress: ProcessingProgress) => void,
  ): Promise<DocumentProcessingResult> {
    this.aborted = false
    const startTime = Date.now()
    const ext = extensionOf(file.name)

    onProgress?.({ stage: "Parsing document with anydoc...", progress: 15, method: "anydoc" })

    // Read the file once: File.arrayBuffer() re-reads the blob on every call,
    // so a second read would cost another full copy of a 50MB upload.
    const buffer = await file.arrayBuffer()
    const extraction = await extractDocument(new Uint8Array(buffer), { fileName: file.name })

    const warnings = [...extraction.warnings]
    const chunks = extraction.chunks.length > 0 ? extraction.chunks : [extraction.text]

    onProgress?.({ stage: "Extracting embedded images...", progress: 75, method: "Image Extraction" })

    let multimodal: MultimodalMetadata | undefined
    if (!this.aborted && ZIP_WORD_EXTENSIONS.includes(ext)) {
      try {
        multimodal = await this.extractImages(buffer, `${file.name}-${startTime}`)
      } catch (error) {
        logger.warn("Image extraction failed; continuing with text only:", error)
        warnings.push("Image extraction failed; text is still available")
      }
    }

    const processingMethod = `anydoc-wasm (${extraction.format.toUpperCase()})`
    onProgress?.({ stage: "Finalizing...", progress: 95, method: processingMethod })

    return {
      text: extraction.text,
      chunks,
      advancedChunks: extraction.advancedChunks,
      metadata: {
        documentType: extraction.format,
        title: file.name,
        format: extraction.format,
        processingMethod,
        extractionQuality: extraction.extractionQuality === "none" ? "low" : extraction.extractionQuality,
        fileSize: file.size,
        processingTime: Date.now() - startTime,
        warnings,
        wordCount: extraction.wordCount,
        paragraphCount: extraction.paragraphCount,
        hasImages: (multimodal?.summary.imageCount ?? 0) > 0,
        multimodal,
      },
    }
  }

  private async extractImages(buffer: ArrayBuffer, documentId: string): Promise<MultimodalMetadata | undefined> {
    const result = await new DOCXImageExtractor().extractFromDocument(buffer, documentId, {
      maxImages: 30,
      minWidth: 32,
      minHeight: 32,
    })

    if (result.totalFound === 0) return undefined

    return {
      images: result.images,
      tables: [],
      equations: [],
      charts: [],
      summary: {
        imageCount: result.images.length,
        tableCount: 0,
        equationCount: 0,
        chartCount: 0,
      },
    }
  }
}
