'use client';

import { AdvancedChunker, type TextChunk } from "./advanced-chunking"

// Import from our new client-only wrapper
import { loadPdfJs, getPdfJs, isPdfJsLoaded } from "./pdf-client"

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

// Interface for detected table structures
interface DetectedTable {
  startRow: number;
  endRow: number;
  columns: number[];
  rows: Array<{
    y: number;
    cells: Array<{ text: string; x: number; width?: number }>
  }>;
  confidence: number;
}

export class EnhancedPDFProcessor {
  // Will be populated when initialized
  private pdfjsLib: PDFJSLib | null = null
  private isInitialized = false
  private chunker: AdvancedChunker
  private processingAborted = false

  constructor() {
    // PDF.js will be initialized lazily when needed
    this.chunker = new AdvancedChunker({
      maxChunkSize: 1000,
      minChunkSize: 200,
      overlap: 150,
      preserveStructure: true,
      semanticSplitting: true,
    })
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

  async processFile(file: File, onProgress?: (progress: ProcessingProgress) => void): Promise<PDFProcessingResult> {
    const startTime = Date.now();
    this.processingAborted = false;
    const warnings: string[] = [];

    try {
      this.validateFile(file);

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

      const result = await this.processWithEnhancedMethod(file, onProgress, startTime, warnings);

      return {
        ...result,
        metadata: {
          ...result.metadata,
          warnings,
        },
      }
    } catch (error) {
      console.error("Enhanced PDF processing failed:", error)

      // Provide detailed fallback result
      const processingTime = Date.now() - startTime
      const fallbackText = this.createDetailedFallbackContent(file, error, processingTime)

      const advancedChunks = this.chunker.chunkText(fallbackText)
      const chunks = advancedChunks.map((chunk) => chunk.content)

      return {
        text: fallbackText,
        chunks,
        advancedChunks,
        metadata: {
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
          warnings: [
            "PDF processing failed",
            error instanceof Error ? error.message : "Unknown error",
            "Using structured fallback content",
          ],
        },
      }
    }
  }

  private validateFile(file: File): void {
    if (!file) {
      throw new Error("No file provided")
    }

    if (file.type !== "application/pdf") {
      throw new Error("File must be a PDF document")
    }

    if (file.size > 100 * 1024 * 1024) {
      throw new Error("File size exceeds 100MB limit")
    }

    if (file.size === 0) {
      throw new Error("File is empty")
    }
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
    onProgress?: (progress: ProcessingProgress) => void,
    startTime: number = Date.now(),
    warnings: string[] = []
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

    const advancedChunks = this.chunker.chunkText(textExtractionResult.fullText.trim())
    const chunks = advancedChunks.map((chunk) => chunk.content)

    onProgress?.({
      stage: "Finalizing processing...",
      progress: 95,
      method: "Enhanced PDF.js",
    })

    const processingTime = Date.now() - startTime

    return {
      text: textExtractionResult.fullText.trim(),
      chunks,
      advancedChunks,
      metadata: {
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
        ),
        language: this.detectLanguage(textExtractionResult.fullText),
        fileSize: file.size,
        processingTime,
        successfulPages: textExtractionResult.successfulPages,
        failedPages: textExtractionResult.failedPages,
        confidence: textExtractionResult.confidence,
        warnings,
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

      // Detect tables using glyph positioning
      const detectedTables = this.detectTablesFromTextContent(textContent, pageNum);
      
      // Format text with table detection
      const formattedText = this.formatTextContentWithTables(textContent, detectedTables);
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

  // Interface for detected table structures

  private detectTablesFromTextContent(textContent: any, pageNum: number): DetectedTable[] {
    if (!textContent?.items || textContent.items.length === 0) {
      return [];
    }

    try {
      // Group text items by Y coordinate (rows)
      const rowGroups = new Map<number, any[]>();
      const yTolerance = 2; // pixels tolerance for same row

      textContent.items.forEach((item: any) => {
        if (!item.transform || item.transform.length < 6) return;
        
        const y = Math.round(item.transform[5]); // Y coordinate
        let foundRow = false;

        // Find existing row within tolerance
        for (const [existingY, items] of rowGroups.entries()) {
          if (Math.abs(y - existingY) <= yTolerance) {
            items.push(item);
            foundRow = true;
            break;
          }
        }

        if (!foundRow) {
          rowGroups.set(y, [item]);
        }
      });

      // Sort rows by Y coordinate (top to bottom)
      const sortedRows = Array.from(rowGroups.entries())
        .sort(([a], [b]) => b - a) // Higher Y values first (PDF coordinates)
        .map(([y, items]) => ({
          y,
          items: items.sort((a, b) => a.transform[4] - b.transform[4]) // Sort by X coordinate
        }));

      // Detect potential table structures
      const detectedTables: DetectedTable[] = [];
      
      // Look for rows with consistent column patterns
      for (let i = 0; i < sortedRows.length - 2; i++) {
        const tableCandidate = this.analyzeTableStructure(sortedRows, i);
        if (tableCandidate && tableCandidate.confidence > 0.6) {
          detectedTables.push(tableCandidate);
        }
      }

      if (detectedTables.length > 0) {
        console.log(`Detected ${detectedTables.length} potential tables on page ${pageNum}`);
      }

      return detectedTables;
    } catch (error) {
      console.warn(`Table detection failed for page ${pageNum}:`, error);
      return [];
    }
  }

  private analyzeTableStructure(rows: any[], startIndex: number): DetectedTable | null {
    const minTableRows = 3;
    const maxTableRows = 20;
    
    // Analyze column positions for consistency
    const columnPositions = new Set<number>();
    const tableRows: any[] = [];
    
    // Look ahead to find consistent column patterns
    for (let i = startIndex; i < Math.min(startIndex + maxTableRows, rows.length); i++) {
      const row = rows[i];
      const rowXPositions = row.items.map((item: any) => Math.round(item.transform[4]));
      
      // Check if this row has a consistent column pattern
      if (rowXPositions.length >= 2) {
        rowXPositions.forEach((x: number) => columnPositions.add(x));
        tableRows.push(row);
      } else {
        // Single column might indicate end of table
        if (tableRows.length >= minTableRows) break;
      }
    }

    if (tableRows.length < minTableRows) {
      return null;
    }

    // Calculate table confidence based on column consistency
    const uniqueColumns = Array.from(columnPositions).sort((a, b) => a - b);
    let totalAlignedCells = 0;
    let totalCells = 0;

    const processedRows = tableRows.map(row => {
      const cells = row.items.map((item: any) => {
        const x = Math.round(item.transform[4]);
        const text = item.str || '';
        totalCells++;
        
        // Check if this cell aligns with detected columns
        const alignsWithColumn = uniqueColumns.some(colX => Math.abs(x - colX) <= 5);
        if (alignsWithColumn) totalAlignedCells++;
        
        return { text, x };
      });

      return {
        y: row.y,
        cells
      };
    });

    const confidence = totalCells > 0 ? totalAlignedCells / totalCells : 0;
    
    return {
      startRow: startIndex,
      endRow: startIndex + tableRows.length - 1,
      columns: uniqueColumns,
      rows: processedRows,
      confidence
    };
  }

  private formatTextContentWithTables(textContent: any, detectedTables: DetectedTable[]): string {
    if (!textContent?.items) return "";
    
    // If no tables detected, use standard formatting
    if (detectedTables.length === 0) {
      return this.formatTextContentEnhanced(textContent);
    }

    // Process tables and convert to markdown format
    let result = "";
    let processedItems = new Set<number>();

    detectedTables.forEach((table: DetectedTable, tableIndex: number) => {
      result += `\n\n**Table ${tableIndex + 1}** (Confidence: ${Math.round(table.confidence * 100)}%)\n\n`;
      
      // Convert table to markdown
      const markdownTable = this.convertTableToMarkdown(table);
      result += markdownTable + "\n";
      
      // Mark items as processed
      table.rows.forEach((row: any) => {
        row.cells.forEach((cell: any) => {
          // This is a simplified approach - in a real implementation,
          // you'd need to track which original text items correspond to table cells
        });
      });
    });

    // Add any remaining non-table text
    const remainingText = this.formatTextContentEnhanced(textContent);
    if (remainingText.trim()) {
      result += "\n\n" + remainingText;
    }

    return result.trim();
  }

  private convertTableToMarkdown(table: DetectedTable): string {
    if (table.rows.length === 0) return "";

    let markdown = "";
    
    // Process each row
    table.rows.forEach((row: any, rowIndex: number) => {
      if (row.cells.length === 0) return;
      
      // Sort cells by X position
      const sortedCells = row.cells.sort((a: any, b: any) => a.x - b.x);
      
      // Create table row
      const cellTexts = sortedCells.map((cell: any) => cell.text.trim() || " ");
      markdown += "| " + cellTexts.join(" | ") + " |\n";
      
      // Add header separator after first row
      if (rowIndex === 0) {
        markdown += "|" + cellTexts.map(() => "---").join("|") + "|\n";
      }
    });
    
    return markdown;
  }

  private calculateTextConfidence(text: string, itemCount: number): number {
    if (!text || text.trim() === "") return 0;
    
    // Basic confidence calculation based on text characteristics
    let confidence = 50; // Base confidence
    
    // Boost confidence for longer texts
    if (text.length > 100) confidence += 20;
    if (text.length > 500) confidence += 10;
    
    // Boost confidence for proper sentences
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length > 1) confidence += 15;
    
    // Boost confidence for consistent spacing
    const words = text.split(/\s+/).filter(w => w.length > 0);
    if (words.length > itemCount * 0.8) confidence += 10;
    
    return Math.min(confidence, 95); // Cap at 95%
  }

  private determineExtractionQuality(
    successfulPages: number, 
    totalPages: number, 
    text: string
  ): "high" | "medium" | "low" {
    const successRate = successfulPages / totalPages;
    const avgWordsPerPage = text.split(/\s+/).length / totalPages;
    
    if (successRate >= 0.9 && avgWordsPerPage > 50) return "high";
    if (successRate >= 0.7 && avgWordsPerPage > 20) return "medium";
    return "low";
  }

  private detectLanguage(text: string): string {
    if (!text || text.trim().length < 50) return "unknown";
    
    // Simple language detection based on common words
    const english = /\b(the|and|or|but|in|on|at|to|for|of|with|by)\b/gi;
    const englishMatches = (text.match(english) || []).length;
    
    if (englishMatches > text.split(/\s+/).length * 0.1) {
      return "en";
    }
    
    return "unknown";
  }

  private createDetailedFallbackContent(file: File, error: any, processingTime: number): string {
    return `# PDF Processing Failed

## File Information
- **Filename**: ${file.name}
- **Size**: ${(file.size / 1024 / 1024).toFixed(2)} MB
- **Processing Time**: ${processingTime}ms

## Error Details
${error instanceof Error ? error.message : "Unknown processing error"}

## Recommendations
1. **Try a different PDF**: Some PDFs have complex formatting that may not be supported
2. **Check file integrity**: Ensure the PDF file is not corrupted
3. **Use text-based PDFs**: Scanned documents may require OCR processing
4. **Manual text extraction**: Consider copying text directly from the PDF viewer

This appears to be a complex PDF document that requires specialized processing tools.`;
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

  public abort(): void {
    this.processingAborted = true;
  }

  public get isProcessing(): boolean {
    return !this.processingAborted;
  }
}
