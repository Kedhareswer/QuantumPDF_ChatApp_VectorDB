'use client';

import { AdvancedChunker, type TextChunk } from "./advanced-chunking"
import { BrowserOCRProcessor } from "./ocr-processor"
import Papa from "papaparse"
import * as XLSX from "xlsx"
import type { MultimodalMetadata } from "@/types/multimodal-types"
import { PDFImageExtractor, type PagePreviewExtractionOptions } from "./image-extractor"
import { PDFTableExtractor } from "./table-extractor"
import { EquationExtractor } from "./equation-extractor"

// Import from our new client-only wrapper
import { loadPdfJs, getPdfJs, isPdfJsLoaded } from "./pdf-client"

interface EnhancedPDFProcessorOptions {
  enableOCR?: boolean
  ocrLanguage?: string
  ocrScale?: number
  capturePagePreviews?: boolean
  maxPreviewPages?: number
  previewScale?: number
  previewQuality?: number
  extractTables?: boolean
  extractEquations?: boolean
}

interface PDFProcessorRunOptions {
  enableOCR?: boolean
  forceOCR?: boolean
  ocrLanguage?: string
}

interface RuntimeOCROptions {
  enableOCR: boolean
  forceOCR: boolean
  ocrLanguage: string
}

type SupportedDocumentType = "pdf" | "csv" | "spreadsheet"

const SUPPORTED_DOCUMENT_TYPES: Record<
  SupportedDocumentType,
  { mimeTypes: string[]; extensions: string[]; label: string }
> = {
  pdf: {
    mimeTypes: ["application/pdf"],
    extensions: ["pdf"],
    label: "PDF",
  },
  csv: {
    mimeTypes: ["text/csv", "application/csv"],
    extensions: ["csv"],
    label: "CSV",
  },
  spreadsheet: {
    mimeTypes: [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel.sheet.macroenabled.12",
    ],
    extensions: ["xlsx", "xls", "xlsm", "xlsb"],
    label: "Spreadsheet",
  },
}

// Define a type for the PDF.js library to avoid TypeScript errors
type PDFJSLib = {
  getDocument: any;
  GlobalWorkerOptions: any;
  version: string;
  PDFWorker: any;
  AnnotationLayer: any;
  renderTextLayer: any;
}

export interface PDFProcessingResult {
  text: string
  chunks: string[]
  advancedChunks?: TextChunk[]
  metadata: {
    documentType: SupportedDocumentType
    title?: string
    author?: string
    subject?: string
    creator?: string
    producer?: string
    creationDate?: Date
    modificationDate?: Date
    pages: number
    processingMethod: string
    extractionQuality: "high" | "medium" | "low"
    language?: string
    fileSize: number
    processingTime: number
    successfulPages: number
    failedPages: number
    confidence: number
    warnings: string[]
    ocrUsed?: boolean
    ocrConfidence?: number
    sheetCount?: number
    rowCount?: number
    columnCount?: number
    multimodal?: MultimodalMetadata
  }
}

export interface ProcessingProgress {
  stage: string
  progress: number
  details?: string
  method?: string
  currentPage?: number
  totalPages?: number
}

export class EnhancedPDFProcessor {
  // Will be populated when initialized
  private pdfjsLib: PDFJSLib | null = null
  private isInitialized = false
  private chunker: AdvancedChunker
  private processingAborted = false
  private options: EnhancedPDFProcessorOptions
  private ocrProcessor: BrowserOCRProcessor | null = null
  private imageExtractor: PDFImageExtractor | null = null
  private tableExtractor: PDFTableExtractor | null = null
  private equationExtractor: EquationExtractor | null = null

  constructor(options: EnhancedPDFProcessorOptions = {}) {
    this.options = {
      enableOCR: false,
      ocrLanguage: "eng",
      capturePagePreviews: true,
      maxPreviewPages: 3,
      previewScale: 1.4,
      previewQuality: 0.85,
      extractTables: true,
      extractEquations: true,
      ...options,
    }
    // PDF.js will be initialized lazily when needed
    this.chunker = new AdvancedChunker({
      maxChunkSize: 1000,
      minChunkSize: 200,
      overlap: 150,
      preserveStructure: true,
      semanticSplitting: true,
      documentAware: true,
      adaptiveThreshold: true,
    })
  }

  private getRuntimeOCROptions(runOptions?: PDFProcessorRunOptions): RuntimeOCROptions {
    return {
      enableOCR: runOptions?.enableOCR ?? this.options.enableOCR ?? false,
      forceOCR: runOptions?.forceOCR ?? false,
      ocrLanguage: runOptions?.ocrLanguage ?? this.options.ocrLanguage ?? "eng",
    }
  }

  private async getOCRProcessor(language: string): Promise<BrowserOCRProcessor> {
    if (!this.ocrProcessor) {
      this.ocrProcessor = new BrowserOCRProcessor(language)
    } else {
      this.ocrProcessor.setLanguage(language)
    }
    return this.ocrProcessor
  }

  private buildDocumentId(file: File, startTime: number): string {
    return `${file.name}-${startTime}`
  }

  private async extractPdfMultimodalMetadata(
    pdf: any,
    file: File,
    documentId: string,
    onProgress?: (progress: ProcessingProgress) => void,
  ): Promise<MultimodalMetadata | undefined> {
    if (!this.options.capturePagePreviews) {
      return undefined
    }

    try {
      if (!this.imageExtractor) {
        this.imageExtractor = new PDFImageExtractor({
          maxPages: this.options.maxPreviewPages ?? 3,
          quality: this.options.previewQuality ?? 0.85,
          scale: this.options.previewScale ?? 1.4,
        })
      }

      // Extract page previews
      const previewExtraction = await this.imageExtractor.extractPagePreviews(
        pdf,
        documentId,
        {
          maxPages: this.options.maxPreviewPages ?? 3,
          quality: this.options.previewQuality ?? 0.85,
          scale: this.options.previewScale ?? 1.4,
        },
        (progress) => {
          onProgress?.({
            stage: progress.stage,
            progress: 60 + (progress.processed / Math.max(progress.total || 1, 1)) * 10,
            method: "Multimodal Extraction",
            currentPage: progress.pageNumber,
            totalPages: progress.total,
          })
        },
      )

      // Extract inline images (figures, charts, diagrams)
      const inlineExtraction = await this.imageExtractor.extractInlineImages(
        pdf,
        documentId,
        {
          maxImages: 20, // Limit inline images per document
          minWidth: 64,
          minHeight: 64,
          quality: 0.80,
        },
        (progress) => {
          onProgress?.({
            stage: progress.stage,
            progress: 70 + (progress.processed / Math.max(progress.total || 1, 1)) * 10,
            method: "Inline Image Extraction",
            currentPage: progress.pageNumber,
            totalPages: progress.total,
          })
        },
      )

      // Combine all images
      const allImages = [...previewExtraction.images, ...inlineExtraction.images]

      // Extract tables if enabled
      let tableExtraction: { tables: any[]; totalFound: number; extractionTime: number } = { tables: [], totalFound: 0, extractionTime: 0 }
      if (this.options.extractTables) {
        if (!this.tableExtractor) {
          this.tableExtractor = new PDFTableExtractor()
        }

        tableExtraction = await this.tableExtractor.extractTablesFromText(
          pdf,
          documentId,
          {
            maxTables: 10,
            minRows: 2,
            minColumns: 2,
          },
          (progress) => {
            onProgress?.({
              stage: progress.stage,
              progress: 80 + (progress.processed / Math.max(progress.total || 1, 1)) * 5,
              method: "Table Extraction",
              currentPage: progress.pageNumber,
              totalPages: progress.total,
            })
          },
        )
      }

      // Extract equations if enabled
      let equationExtraction: { equations: any[]; totalFound: number; extractionTime: number } = { equations: [], totalFound: 0, extractionTime: 0 }
      if (this.options.extractEquations) {
        if (!this.equationExtractor) {
          this.equationExtractor = new EquationExtractor()
        }

        equationExtraction = await this.equationExtractor.extractFromPDF(
          pdf,
          documentId,
          {
            maxEquations: 30,
            detectInline: true,
            detectBlock: true,
          },
          (progress) => {
            onProgress?.({
              stage: progress.stage,
              progress: 85 + (progress.processed / Math.max(progress.total || 1, 1)) * 5,
              method: "Equation Extraction",
              currentPage: progress.pageNumber,
              totalPages: progress.total,
            })
          },
        )
      }

      return {
        images: allImages,
        tables: tableExtraction.tables,
        equations: equationExtraction.equations,
        charts: [],
        summary: {
          imageCount: allImages.length,
          tableCount: tableExtraction.tables.length,
          equationCount: equationExtraction.equations.length,
          chartCount: 0,
        },
      }
    } catch (error) {
      console.error("Failed to extract multimodal metadata:", error)
      return undefined
    }
  }

  private shouldUseOCRFallback(result: PDFProcessingResult | null, options: RuntimeOCROptions): boolean {
    if (!options.enableOCR && !options.forceOCR) {
      return false
    }

    if (options.forceOCR) {
      return true
    }

    if (!result) {
      return true
    }

    const textLength = result.text?.trim().length || 0
    const successfulPages = result.metadata.successfulPages ?? 0
    const extractionQuality = result.metadata.extractionQuality

    const noTextDetected = textLength < 50
    const noSuccessfulPages = successfulPages === 0
    const lowQuality = extractionQuality === "low"

    return noTextDetected || noSuccessfulPages || lowQuality
  }

  private async initializePDFJS(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      console.log("Initializing Enhanced PDF.js library...");
      
      // Load the PDF.js library
      const pdfjsLib = await loadPdfJs();
      if (!pdfjsLib) {
        throw new Error("Failed to load PDF.js library");
      }
      
      this.pdfjsLib = pdfjsLib;
      this.isInitialized = true;
      
      console.log("PDF.js library initialized successfully");
      return true;
    } catch (error) {
      console.error("Failed to initialize PDF processor:", error);
      this.isInitialized = false;
      return false;
    }
  }

  public async initialize(): Promise<boolean> {
    return await this.initializePDFJS();
  }

  async processFile(
    file: File,
    onProgress?: (progress: ProcessingProgress) => void,
    runOptions?: PDFProcessorRunOptions,
  ): Promise<PDFProcessingResult> {
    const startTime = Date.now();
    this.processingAborted = false;
    const warnings: string[] = [];
    const documentType = this.validateFile(file);
    const runtimeOCROptions = documentType === "pdf" ? this.getRuntimeOCROptions(runOptions) : this.getRuntimeOCROptions(runOptions);
    const documentId = this.buildDocumentId(file, startTime);

    try {
      if (documentType === "pdf") {
        onProgress?.({
          stage: "Initializing enhanced PDF processor...",
          progress: 2,
          method: "Enhanced PDF.js",
        });

        const isInitialized = await this.initializePDFJS();
        if (!isInitialized) {
          throw new Error("Failed to initialize PDF processor");
        }

        onProgress?.({
          stage: "Loading PDF document...",
          progress: 5,
          method: "Enhanced PDF.js",
        });

        const result = await this.processWithEnhancedMethod(file, documentId, onProgress, startTime, warnings);

        if (this.shouldUseOCRFallback(result, runtimeOCROptions)) {
          warnings.push(
            "Primary text extraction produced limited results. Attempting OCR fallback for image-based pages.",
          )
          return await this.processWithOCR(file, documentId, onProgress, startTime, warnings, runtimeOCROptions)
        }

        return {
          ...result,
          metadata: {
            ...result.metadata,
            warnings,
            ocrUsed: false,
          },
        }
      }

      if (documentType === "csv") {
        return await this.processCsvDocument(file, onProgress, startTime, warnings)
      }

      return await this.processSpreadsheetDocument(file, onProgress, startTime, warnings)
    } catch (error) {
      console.error("Enhanced PDF processing failed:", error)

      if (documentType === "pdf" && this.shouldUseOCRFallback(null, runtimeOCROptions)) {
        try {
          warnings.push("Standard extraction failed. Attempting OCR fallback...")
          return await this.processWithOCR(file, documentId, onProgress, startTime, warnings, runtimeOCROptions)
        } catch (ocrError) {
          const message = ocrError instanceof Error ? ocrError.message : "Unknown OCR error"
          warnings.push(`OCR fallback failed: ${message}`)
          console.error("OCR fallback failed:", ocrError)
        }
      }

      // Provide detailed fallback result
      const processingTime = Date.now() - startTime
      const fallbackText = this.createDetailedFallbackContent(file, error, processingTime)

      const advancedChunks = this.chunker.chunkText(fallbackText, Date.now().toString(), file.name)
      const chunks = advancedChunks.map((chunk) => chunk.content)

      return {
        text: fallbackText,
        chunks,
        advancedChunks,
        metadata: {
          documentType,
          title: file.name,
          author: "Enhanced PDF Processor",
          subject: "Processing failed - fallback content",
          pages: 1,
          processingMethod: "Enhanced Fallback",
          extractionQuality: "low" as const,
          language: "English",
          fileSize: file.size,
          processingTime,
          successfulPages: 0,
          failedPages: 1,
          confidence: 0,
          ocrUsed: false,
          warnings: [
            "PDF processing failed",
            error instanceof Error ? error.message : "Unknown error",
            "Using structured fallback content",
          ...warnings,
          ],
          multimodal: undefined,
        },
      }
    }
  }

  private validateFile(file: File): SupportedDocumentType {
    if (!file) {
      throw new Error("No file provided")
    }

    const documentType = this.detectDocumentType(file)

    if (file.size > 100 * 1024 * 1024) {
      throw new Error("File size exceeds 100MB limit")
    }

    if (file.size === 0) {
      throw new Error("File is empty")
    }

    return documentType
  }

  private detectDocumentType(file: File): SupportedDocumentType {
    const mime = (file.type || "").toLowerCase()
    const extension = file.name?.split(".").pop()?.toLowerCase() || ""

    for (const [type, config] of Object.entries(SUPPORTED_DOCUMENT_TYPES) as [
      SupportedDocumentType,
      (typeof SUPPORTED_DOCUMENT_TYPES)[SupportedDocumentType],
    ][]) {
      if (config.mimeTypes.includes(mime) || config.extensions.includes(extension)) {
        return type
      }
    }

    const supportedList = Object.values(SUPPORTED_DOCUMENT_TYPES)
      .map((config) => config.label)
      .join(", ")

    throw new Error(`Unsupported file type. Supported types: ${supportedList}`)
  }

  private async safeReadFile(file: File): Promise<ArrayBuffer> {
    try {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()

        reader.onload = (event) => {
          if (event.target?.result instanceof ArrayBuffer) {
            resolve(event.target.result)
          } else {
            reject(new Error("Failed to read file as ArrayBuffer"))
          }
        }

        reader.onerror = () => {
          reject(new Error("FileReader error occurred"))
        }

        reader.readAsArrayBuffer(file)
      })
    } catch (error) {
      console.error("Safe file read failed:", error)
      throw new Error("Could not read file data")
    }
  }

  private async processWithEnhancedMethod(
    file: File,
    documentId: string,
    onProgress?: (progress: ProcessingProgress) => void,
    startTime: number = Date.now(),
    warnings: string[] = [],
  ): Promise<PDFProcessingResult> {
    if (!this.pdfjsLib) {
      throw new Error("PDF.js library not initialized");
    }
    onProgress?.({
      stage: "Reading file data...",
      progress: 10,
      method: "Enhanced PDF.js",
    })

    const fileBuffer = await this.safeReadFile(file)

    onProgress?.({
      stage: "Parsing PDF structure...",
      progress: 15,
      method: "Enhanced PDF.js",
    })

    // Create a fresh copy of the buffer to avoid detachment issues
    const bufferCopy = fileBuffer.slice(0)

    let pdf
    try {
      console.log("Configuring PDF.js for no-worker mode...")

      // Ensure worker is properly disabled
      if (this.pdfjsLib.GlobalWorkerOptions) {
        this.pdfjsLib.GlobalWorkerOptions.workerSrc = ""
      }

      console.log("Loading PDF with no-worker configuration...")

      // Force disable worker mode with comprehensive options
      const loadingTask = this.pdfjsLib.getDocument({
        data: new Uint8Array(bufferCopy),
        useWorkerFetch: false,
        disableWorker: true,
        isEvalSupported: false,
        useSystemFonts: true,
        stopAtErrors: false,
        verbosity: 0,
        disableAutoFetch: true,
        disableStream: true,
        cMapPacked: true,
        standardFontDataUrl: undefined,
        cMapUrl: undefined,
      })

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("PDF loading timeout after 30 seconds")), 30000)
      })

      pdf = await Promise.race([loadingTask.promise, timeoutPromise])
      console.log("PDF loaded successfully without worker")
    } catch (error) {
      console.error("PDF loading failed:", error)
      throw new Error(`Failed to load PDF: ${error instanceof Error ? error.message : "Unknown error"}`)
    }

    onProgress?.({
      stage: "Extracting document metadata...",
      progress: 25,
      method: "Enhanced PDF.js",
    })

    let metadata: any = {}
    try {
      const metadataResult = await pdf.getMetadata()
      metadata = metadataResult.info || {}
    } catch (metaError) {
      console.warn("Could not extract metadata:", metaError)
      warnings.push("Metadata extraction failed")
    }

    onProgress?.({
      stage: "Processing document pages...",
      progress: 30,
      method: "Enhanced PDF.js",
      totalPages: pdf.numPages,
    })

    const textExtractionResult = await this.extractTextWithEnhancedMethod(pdf, onProgress, warnings)

    onProgress?.({
      stage: "Creating optimized text chunks...",
      progress: 85,
      method: "Enhanced PDF.js",
    })

    if (!textExtractionResult.fullText.trim()) {
      throw new Error("No readable text content found in PDF")
    }

    const advancedChunks = this.chunker.chunkText(textExtractionResult.fullText.trim(), Date.now().toString(), file.name)
    const chunks = advancedChunks.map((chunk) => chunk.content)

    onProgress?.({
      stage: "Finalizing processing...",
      progress: 95,
      method: "Enhanced PDF.js",
    })

    const processingTime = Date.now() - startTime
    const multimodalMetadata = await this.extractPdfMultimodalMetadata(pdf, file, documentId, onProgress)

    return {
      text: textExtractionResult.fullText.trim(),
      chunks,
      advancedChunks,
      metadata: {
        documentType: "pdf",
        title: metadata.Title || file.name,
        author: metadata.Author || "Unknown",
        subject: metadata.Subject || "",
        creator: metadata.Creator || "",
        producer: metadata.Producer || "",
        creationDate: metadata.CreationDate ? new Date(metadata.CreationDate) : undefined,
        modificationDate: metadata.ModDate ? new Date(metadata.ModDate) : undefined,
        pages: pdf.numPages,
        processingMethod: "Enhanced PDF.js (No Worker)",
        extractionQuality: this.determineExtractionQuality(
          textExtractionResult.successfulPages,
          pdf.numPages,
          textExtractionResult.fullText,
          textExtractionResult.confidence,
        ),
        language: this.detectLanguage(textExtractionResult.fullText),
        fileSize: file.size,
        processingTime,
        successfulPages: textExtractionResult.successfulPages,
        failedPages: textExtractionResult.failedPages,
        confidence: textExtractionResult.confidence,
        warnings,
        multimodal: multimodalMetadata,
      },
    }
  }

  private async processCsvDocument(
    file: File,
    onProgress?: (progress: ProcessingProgress) => void,
    startTime: number = Date.now(),
    warnings: string[] = [],
  ): Promise<PDFProcessingResult> {
    onProgress?.({
      stage: "Reading CSV data...",
      progress: 10,
      method: "CSV Parser",
    })

    const csvText = await file.text()

    onProgress?.({
      stage: "Parsing CSV structure...",
      progress: 35,
      method: "CSV Parser",
    })

    const parsed = Papa.parse<Record<string, unknown>>(csvText, {
      header: true,
      skipEmptyLines: "greedy",
      dynamicTyping: true,
    })

    if (parsed.errors?.length) {
      parsed.errors.slice(0, 3).forEach((err) => {
        warnings.push(`CSV parsing warning: ${err.message} (row ${err.row ?? "unknown"})`)
      })
    }

    const rowCount = Array.isArray(parsed.data) ? parsed.data.length : 0
    const columnCount = parsed.meta?.fields?.length ?? 0
    const csvSummary = this.buildCsvSummary(file.name, rowCount, columnCount, parsed.meta?.fields ?? [])
    const normalizedCsv = csvText.trim()
      ? csvText.trim()
      : "No CSV rows detected. The file may be empty or contain only headers."

    const combinedContent = `${csvSummary}\n\n\`\`\`csv\n${normalizedCsv}\n\`\`\``

    onProgress?.({
      stage: "Chunking CSV content...",
      progress: 85,
      method: "CSV Parser",
    })

    const { chunks, advancedChunks } = this.chunkDocumentText(combinedContent, file.name)
    const processingTime = Date.now() - startTime
    const confidence = Math.max(30, Math.min(95, 85 - (parsed.errors?.length ?? 0) * 10))

    return {
      text: combinedContent,
      chunks,
      advancedChunks,
      metadata: {
        documentType: "csv",
        title: file.name,
        author: "CSV Parser",
        subject: "CSV data ingestion",
        pages: 1,
        processingMethod: "CSV Parser (PapaParse)",
        extractionQuality: rowCount > 0 ? "high" : "low",
        language: this.detectLanguage(combinedContent),
        fileSize: file.size,
        processingTime,
        successfulPages: rowCount,
        failedPages: parsed.errors?.length ?? 0,
        confidence,
        warnings,
        ocrUsed: false,
        rowCount,
        columnCount,
        sheetCount: 1,
      },
    }
  }

  private async processSpreadsheetDocument(
    file: File,
    onProgress?: (progress: ProcessingProgress) => void,
    startTime: number = Date.now(),
    warnings: string[] = [],
  ): Promise<PDFProcessingResult> {
    onProgress?.({
      stage: "Reading spreadsheet bytes...",
      progress: 10,
      method: "SheetJS Parser",
    })

    const buffer = await this.safeReadFile(file)
    const data = new Uint8Array(buffer)

    onProgress?.({
      stage: "Parsing workbook...",
      progress: 30,
      method: "SheetJS Parser",
    })

    let workbook: XLSX.WorkBook
    try {
      workbook = XLSX.read(data, {
        type: "array",
        cellDates: true,
        dateNF: "yyyy-mm-dd",
      })
    } catch (err) {
      throw new Error(`Failed to parse spreadsheet: ${err instanceof Error ? err.message : "Unknown error"}`)
    }

    const sheetSummaries = workbook.SheetNames.map((sheetName) => {
      const sheet = workbook.Sheets[sheetName]
      const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
        header: 1,
        blankrows: false,
        defval: "",
      }) as (string | number | boolean | null)[][]

      const rowCount = matrix.length
      const columnCount = matrix.reduce((max, row) => Math.max(max, row.length), 0)
      const csvContent = XLSX.utils.sheet_to_csv(sheet, { blankrows: false }).trim()

      return {
        name: sheetName,
        rowCount,
        columnCount,
        csvContent: csvContent || "(empty sheet)",
      }
    })

    const totalRows = sheetSummaries.reduce((sum, sheet) => sum + sheet.rowCount, 0)
    const maxColumns = sheetSummaries.reduce((max, sheet) => Math.max(max, sheet.columnCount), 0)

    const workbookSummary = this.buildWorkbookSummary(file.name, sheetSummaries.length, totalRows, maxColumns)
    const sheetsContent = sheetSummaries
      .map((sheet) => {
        return [
          `## Sheet: ${sheet.name}`,
          `Rows: ${sheet.rowCount} • Columns: ${sheet.columnCount}`,
          "",
          "```csv",
          sheet.csvContent,
          "```",
        ].join("\n")
      })
      .join("\n\n---\n\n")

    const combinedContent = `${workbookSummary}\n\n${sheetsContent || "_(Workbook contained no readable cells.)_"}`

    onProgress?.({
      stage: "Chunking spreadsheet content...",
      progress: 85,
      method: "SheetJS Parser",
    })

    const { chunks, advancedChunks } = this.chunkDocumentText(combinedContent, file.name)
    const processingTime = Date.now() - startTime
    const extractionQuality = totalRows > 0 ? "high" : "low"

    return {
      text: combinedContent,
      chunks,
      advancedChunks,
      metadata: {
        documentType: "spreadsheet",
        title: file.name,
        author: "SheetJS Parser",
        subject: "Spreadsheet ingestion",
        pages: Math.max(1, sheetSummaries.length),
        processingMethod: "SheetJS Parser",
        extractionQuality,
        language: this.detectLanguage(combinedContent),
        fileSize: file.size,
        processingTime,
        successfulPages: sheetSummaries.length,
        failedPages: 0,
        confidence: extractionQuality === "high" ? 90 : 60,
        warnings,
        ocrUsed: false,
        sheetCount: sheetSummaries.length,
        rowCount: totalRows,
        columnCount: maxColumns,
      },
    }
  }

  private chunkDocumentText(text: string, fileName: string) {
    const advancedChunks = this.chunker.chunkText(text, Date.now().toString(), fileName)
    return {
      advancedChunks,
      chunks: advancedChunks.map((chunk) => chunk.content),
    }
  }

  private buildCsvSummary(fileName: string, rows: number, columns: number, fields: string[]): string {
    const hasHeaders = fields && fields.length > 0
    const columnList = hasHeaders ? fields.join(", ") : "Headers not detected"

    return [
      `# CSV Document: ${fileName}`,
      "",
      `Rows detected: ${rows}`,
      `Columns detected: ${columns}`,
      hasHeaders ? `Columns: ${columnList}` : "The CSV did not include a header row.",
      "",
      "All rows have been converted into a chunkable text representation for downstream RAG processing.",
    ].join("\n")
  }

  private buildWorkbookSummary(
    fileName: string,
    sheetCount: number,
    totalRows: number,
    maxColumns: number,
  ): string {
    return [
      `# Spreadsheet Document: ${fileName}`,
      "",
      `Sheets: ${sheetCount}`,
      `Total Rows: ${totalRows}`,
      `Max Columns: ${maxColumns}`,
      "",
      "Each sheet is preserved as CSV text for consistent chunking and retrieval.",
    ].join("\n")
  }

  private async processWithOCR(
    file: File,
    documentId: string,
    onProgress?: (progress: ProcessingProgress) => void,
    startTime: number = Date.now(),
    warnings: string[] = [],
    options: RuntimeOCROptions = this.getRuntimeOCROptions(),
  ): Promise<PDFProcessingResult> {
    if (!this.pdfjsLib) {
      throw new Error("PDF.js library not initialized")
    }

    const ocrProcessor = await this.getOCRProcessor(options.ocrLanguage)

    onProgress?.({
      stage: "Preparing OCR fallback...",
      progress: 35,
      method: "OCR Fallback",
    })

    const arrayBuffer = await file.arrayBuffer()
    const loadingTask = this.pdfjsLib.getDocument({
      data: arrayBuffer,
      useWorkerFetch: false,
      disableAutoFetch: true,
      disableStream: true,
    })

    const pdf = await loadingTask.promise

    let fullText = ""
    let successfulPages = 0
    let failedPages = 0
    let totalConfidence = 0

    for (let pageNum = 1; pageNum <= pdf.numPages && !this.processingAborted; pageNum++) {
      try {
        const pageProgress = 35 + (pageNum / pdf.numPages) * 50
        onProgress?.({
          stage: `OCR processing page ${pageNum} of ${pdf.numPages}...`,
          progress: Math.min(pageProgress, 90),
          method: "OCR Fallback",
          currentPage: pageNum,
          totalPages: pdf.numPages,
        })

        const page = await pdf.getPage(pageNum)
        const viewport = page.getViewport({ scale: this.options.ocrScale ?? 1.5 })
        const canvas = document.createElement("canvas")
        const context = canvas.getContext("2d")

        if (!context) {
          throw new Error("Unable to create canvas context for OCR")
        }

        canvas.height = viewport.height
        canvas.width = viewport.width

        await page.render({ canvasContext: context, viewport }).promise

        const ocrResult = await ocrProcessor.processCanvas(canvas)

        if (ocrResult.text.trim()) {
          fullText += `\n\n=== Page ${pageNum} (OCR) ===\n${ocrResult.text}`
          successfulPages++
          totalConfidence += ocrResult.confidence
        } else {
          failedPages++
          warnings.push(`Page ${pageNum}: OCR did not detect text`)
        }

        // Give the browser a breather
        if (pageNum % 2 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 30))
        }
      } catch (pageError) {
        failedPages++
        const message = pageError instanceof Error ? pageError.message : "Unknown OCR error"
        warnings.push(`Page ${pageNum}: OCR error - ${message}`)
        fullText += `\n\n=== Page ${pageNum} (OCR Error) ===\n[OCR failed: ${message}]`
      }
    }

    const pageCount = successfulPages + failedPages

    if (!fullText.trim() || successfulPages === 0) {
      warnings.push("OCR fallback completed but produced limited results. Document may require manual review.")
    }

    onProgress?.({
      stage: "Creating chunks from OCR text...",
      progress: 95,
      method: "OCR Fallback",
    })

    const textOutput = fullText.trim()
      ? fullText.trim()
      : `OCR processing completed, but no readable text was detected. The document might contain low-quality images or unsupported languages.`

    const advancedChunks = this.chunker.chunkText(textOutput, Date.now().toString(), file.name)
    const chunks = advancedChunks.map((chunk) => chunk.content)

    const processingTime = Date.now() - startTime
    const avgConfidence = successfulPages > 0 ? totalConfidence / successfulPages : 0
    const multimodalMetadata = await this.extractPdfMultimodalMetadata(pdf, file, documentId, onProgress)

    return {
      text: textOutput,
      chunks,
      advancedChunks,
      metadata: {
        documentType: "pdf",
        title: file.name,
        author: "OCR Processor",
        subject: "OCR extracted content",
        pages: pdf.numPages,
        processingMethod: "OCR Fallback",
        extractionQuality: avgConfidence > 80 ? "high" : avgConfidence > 60 ? "medium" : "low",
        language: this.detectLanguage(textOutput),
        fileSize: file.size,
        processingTime,
        successfulPages,
        failedPages,
        confidence: avgConfidence,
        warnings,
        ocrUsed: true,
        ocrConfidence: avgConfidence,
        multimodal: multimodalMetadata,
      },
    }
  }

  private async extractTextWithEnhancedMethod(
    pdf: any,
    onProgress?: (progress: ProcessingProgress) => void,
    warnings: string[] = [],
  ): Promise<{
    fullText: string
    successfulPages: number
    failedPages: number
    confidence: number
  }> {
    let fullText = ""
    let successfulPages = 0
    let failedPages = 0
    let totalConfidence = 0
    let confidenceCount = 0
    const totalPages = pdf.numPages

    for (let pageNum = 1; pageNum <= totalPages && !this.processingAborted; pageNum++) {
      try {
        const progress = 30 + (pageNum / totalPages) * 50
        onProgress?.({
          stage: `Processing page ${pageNum} of ${totalPages}...`,
          progress,
          method: "Enhanced PDF.js",
          currentPage: pageNum,
          totalPages,
          details: `${successfulPages} pages completed successfully`,
        })

        const page = await pdf.getPage(pageNum)
        const pageResult = await this.extractPageTextEnhanced(page, pageNum)

        if (pageResult.text.trim()) {
          fullText += `\n\n=== Page ${pageNum} ===\n${pageResult.text}`
          successfulPages++
          totalConfidence += pageResult.confidence
          confidenceCount++
        } else {
          failedPages++
          warnings.push(`Page ${pageNum}: No text content found`)
          fullText += `\n\n=== Page ${pageNum} (No Content) ===\n[This page appears to contain no extractable text content]`
        }

        // Add delay every few pages to prevent browser freezing
        if (pageNum % 3 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 50))
        }
      } catch (pageError) {
        failedPages++;
        const errorMsg = pageError instanceof Error ? pageError.message : "Unknown error";
        console.warn(`Error processing page ${pageNum}:`, pageError);
        warnings.push(`Page ${pageNum}: Processing error - ${errorMsg}`);
        fullText += `\n\n=== Page ${pageNum} (Error) ===\n[Page processing failed: ${errorMsg}]`;
      }
    }

    const averageConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;

    return {
      fullText: fullText.trim(),
      successfulPages,
      failedPages,
      confidence: averageConfidence,
    };
  }

  private async extractPageTextEnhanced(
    page: any,
    pageNum: number
  ): Promise<{ text: string; confidence: number }> {
    try {
      const textContent = await page.getTextContent({
        normalizeWhitespace: true,
        disableCombineTextItems: false,
      });

      if (!textContent?.items || textContent.items.length === 0) {
        return { text: "", confidence: 0 };
      }

      const formattedText = this.formatTextContentEnhanced(textContent);
      const confidence = this.calculateTextConfidence(formattedText, textContent.items.length);

      return {
        text: formattedText,
        confidence,
      };
    } catch (error) {
      console.warn(`Enhanced text extraction failed for page ${pageNum}:`, error);
      return { text: "", confidence: 0 };
    }
  }

  private formatTextContentEnhanced(textContent: any): string {
    if (!textContent?.items) return "";

    let text = "";
    let lastY: number | null = null;
    const lines: Array<{ y: number; text: string }> = [];

    for (const item of textContent.items) {
      if (!item.str || item.str.trim() === "") continue;

      const currentY = Math.round(item.transform[5]);

      if (lastY === null || Math.abs(currentY - lastY) > 3) {
        lines.push({ y: currentY, text: item.str });
      } else {
        const lastLine = lines[lines.length - 1];
        lastLine.text += " " + item.str;
      }

      lastY = currentY;
    }

    lines.sort((a, b) => b.y - a.y);

    let previousY: number | null = null;
    for (const line of lines) {
      const lineText = line.text.trim();
      if (!lineText) continue;

      if (previousY !== null && previousY - line.y > 20) {
        text += "\n\n";
      } else if (text && !text.endsWith("\n")) {
        text += "\n";
      }

      text += lineText;
      previousY = line.y;
    }

    return text
      .replace(/\s+/g, " ")
      .replace(/\n\s*\n\s*\n/g, "\n\n")
      .trim();
  }

  
  private calculateTextConfidence(text: string, itemCount: number): number {
    if (!text || text.length === 0) return 0;

    let confidence = 50;

    if (text.length > 100) confidence += 20;
    if (text.length > 500) confidence += 10;

    const wordCount = text.split(/\s+/).length;
    if (wordCount > 20) confidence += 10;
    if (wordCount > 100) confidence += 5;

    if (text.includes("\n\n")) confidence += 5;
    if (/[.!?]/.test(text)) confidence += 5;
    if (/[A-Z][a-z]/.test(text)) confidence += 5;

    if (text.length < 50) confidence -= 20;
    if (!/[a-zA-Z]/.test(text)) confidence -= 30;

    return Math.max(0, Math.min(100, confidence));
  }

  private determineExtractionQuality(
    successfulPages: number,
    totalPages: number,
    text: string,
    confidence: number,
  ): "high" | "medium" | "low" {
    const successRate = successfulPages / totalPages;
    const textDensity = text.length / totalPages;
    const avgConfidence = confidence;

    if (successRate >= 0.9 && textDensity > 800 && avgConfidence > 80) return "high";
    if (successRate >= 0.7 && textDensity > 400 && avgConfidence > 60) return "medium";
    return "low";
  }

  private detectLanguage(text: string): string {
    if (!text) return 'en';
    
    const sample = text.slice(0, 2000).toLowerCase();
    const languages: Record<string, string[]> = {
      english: ["the", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "is", "are"],
      spanish: ["el", "la", "de", "que", "y", "en", "un", "es", "se", "no"],
      french: ["le", "de", "et", "à", "un", "il", "être", "en", "avoir", "que"],
      german: ["der", "die", "und", "in", "den", "von", "zu", "das", "mit", "sich"],
    };

    let bestMatch = "english";
    let bestScore = 0;

    for (const [language, words] of Object.entries(languages)) {
      const score = words.reduce((count, word) => {
        const regex = new RegExp(`\\b${word}\\b`, "gi")
        const matches = sample.match(regex)
        return count + (matches ? matches.length : 0)
      }, 0)

      if (score > bestScore) {
        bestScore = score
        bestMatch = language.charAt(0).toUpperCase() + language.slice(1)
      }
    }

    return bestScore > 5 ? bestMatch : "Unknown"
  }

  private createDetailedFallbackContent(file: File, error: any, processingTime: number): string {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"

    return `# PDF Processing Report: ${file.name}

## Processing Status: FAILED

**Error**: ${errorMessage}
**Processing Time**: ${(processingTime / 1000).toFixed(2)} seconds
**File Size**: ${(file.size / 1024 / 1024).toFixed(2)} MB
**Date**: ${new Date().toLocaleString()}

## What Happened?
The enhanced PDF processor encountered an issue while trying to extract text from your document.

### Common Causes:
1. **Scanned Documents**: The PDF contains images of text rather than actual text
2. **Complex Formatting**: Advanced layouts, tables, or graphics that are difficult to parse
3. **Encrypted Content**: Password-protected or secured documents
4. **File Corruption**: The PDF file may be damaged or incomplete
5. **Browser Compatibility**: Some browsers have limitations with PDF processing

### Recommended Solutions:
1. **Try a Different PDF**: Test with a simpler, text-based PDF document
2. **Different Browser**: Try using Chrome, Firefox, or Safari
3. **Manual Text Entry**: Copy and paste text directly from a PDF viewer
4. **OCR Tools**: Use dedicated OCR software for scanned documents

## System Information:
- **Processor**: Enhanced PDF.js Engine (No Worker)
- **Processing Method**: Client-side text extraction
- **Fallback Status**: Active

## Next Steps:
This fallback document allows you to continue using the system. You can:

1. Upload a different PDF file
2. Use the manual text input feature
3. Try the suggestions above

The system remains fully functional for other operations and document types.

---
*This is an automatically generated fallback document to ensure system continuity.*`
  }

  public abort(): void {
    this.processingAborted = true
  }

  public isProcessing(): boolean {
    return !this.processingAborted
  }
}
