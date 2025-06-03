import { AdvancedChunker, type TextChunk } from "./advanced-chunking"

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

export class EnhancedPDFProcessor {
  private pdfjsLib: any = null
  private isInitialized = false
  private chunker: AdvancedChunker
  private processingAborted = false
  private workerConfigured = false

  constructor() {
    this.chunker = new AdvancedChunker({
      maxChunkSize: 1000,
      minChunkSize: 200,
      overlap: 150,
      preserveStructure: true,
      semanticSplitting: true,
    })
  }

  private async initializePDFJS(): Promise<void> {
    if (this.isInitialized) return

    try {
      console.log("Initializing Enhanced PDF.js library...")

      const pdfjs = await import("pdfjs-dist")
      this.pdfjsLib = pdfjs.default || pdfjs

      if (!this.pdfjsLib?.getDocument) {
        throw new Error("PDF.js getDocument method not available")
      }

      console.log(`PDF.js version: ${this.pdfjsLib.version || "unknown"}`)

      // Configure worker with version matching
      await this.configureWorker()

      this.isInitialized = true
      console.log("Enhanced PDF.js initialized successfully")
    } catch (error) {
      console.error("Failed to initialize Enhanced PDF.js:", error)
      throw new Error(
        `Enhanced PDF.js initialization failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      )
    }
  }

  private async configureWorker(): Promise<void> {
    if (typeof window === "undefined" || !this.pdfjsLib.GlobalWorkerOptions) {
      console.log("Worker configuration not available (server-side or no GlobalWorkerOptions)")
      return
    }

    try {
      const version = this.pdfjsLib.version
      console.log(`Configuring worker for PDF.js version: ${version}`)

      // Try version-specific worker sources first
      const versionSpecificSources = version
        ? [
            `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.js`,
            `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.js`,
          ]
        : []

      // Fallback to generic sources
      const genericSources = [
        "https://cdn.jsdelivr.net/npm/pdfjs-dist/build/pdf.worker.min.js",
        "https://unpkg.com/pdfjs-dist/build/pdf.worker.min.js",
      ]

      const allSources = [...versionSpecificSources, ...genericSources]

      for (const workerSrc of allSources) {
        try {
          console.log(`Testing worker source: ${workerSrc}`)

          // Test worker availability with timeout
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 5000)

          const testResponse = await fetch(workerSrc, {
            method: "HEAD",
            mode: "cors",
            signal: controller.signal,
          }).catch(() => null)

          clearTimeout(timeoutId)

          if (testResponse && testResponse.ok) {
            this.pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc
            this.workerConfigured = true
            console.log(`Worker configured successfully: ${workerSrc}`)
            return
          }
        } catch (error) {
          console.warn(`Worker source failed: ${workerSrc}`, error)
          continue
        }
      }

      console.warn("All worker sources failed, disabling worker")
      // Disable worker entirely to avoid version conflicts
      this.pdfjsLib.GlobalWorkerOptions.workerSrc = null
      this.workerConfigured = false
    } catch (error) {
      console.error("Worker configuration failed:", error)
      this.pdfjsLib.GlobalWorkerOptions.workerSrc = null
      this.workerConfigured = false
    }
  }

  async processFile(file: File, onProgress?: (progress: ProcessingProgress) => void): Promise<PDFProcessingResult> {
    const startTime = Date.now()
    this.processingAborted = false
    const warnings: string[] = []

    try {
      this.validateFile(file)

      onProgress?.({
        stage: "Initializing enhanced PDF processor...",
        progress: 2,
        method: "Enhanced PDF.js",
      })

      await this.initializePDFJS()

      onProgress?.({
        stage: "Loading PDF document...",
        progress: 5,
        method: "Enhanced PDF.js",
      })

      const result = await this.processWithEnhancedMethod(file, onProgress, startTime, warnings)

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

    // Check for common file corruption indicators
    if (file.name.includes("..") || file.name.includes("/") || file.name.includes("\\")) {
      throw new Error("Invalid file name")
    }
  }

  private async safeReadFile(file: File): Promise<Uint8Array> {
    try {
      // Use FileReader for more reliable file reading
      return new Promise((resolve, reject) => {
        const reader = new FileReader()

        reader.onload = (event) => {
          if (event.target?.result instanceof ArrayBuffer) {
            resolve(new Uint8Array(event.target.result))
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
    warnings: string[] = [],
  ): Promise<PDFProcessingResult> {
    onProgress?.({
      stage: "Reading file data...",
      progress: 10,
      method: "Enhanced PDF.js",
    })

    // Use safer file reading method
    const fileData = await this.safeReadFile(file)

    onProgress?.({
      stage: "Parsing PDF structure...",
      progress: 15,
      method: "Enhanced PDF.js",
    })

    // Try multiple loading strategies to handle version conflicts
    let pdf
    const loadingStrategies = [
      // Strategy 1: No worker (most compatible)
      {
        name: "No Worker",
        options: {
          data: fileData.slice(), // Clone the data
          useWorkerFetch: false,
          disableWorker: true,
          isEvalSupported: false,
          useSystemFonts: true,
          stopAtErrors: false,
          maxImageSize: 1024 * 1024,
          cMapPacked: true,
          disableAutoFetch: true,
          disableStream: true,
          verbosity: 0,
        },
      },
      // Strategy 2: Basic options
      {
        name: "Basic",
        options: {
          data: fileData.slice(),
          useWorkerFetch: false,
          stopAtErrors: false,
          verbosity: 0,
        },
      },
      // Strategy 3: Minimal options
      {
        name: "Minimal",
        options: {
          data: fileData.slice(),
        },
      },
    ]

    let lastError: Error | null = null

    for (const strategy of loadingStrategies) {
      try {
        console.log(`Trying loading strategy: ${strategy.name}`)

        const loadingTask = this.pdfjsLib.getDocument(strategy.options)

        // Add timeout handling
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("PDF loading timeout")), 30000)
        })

        pdf = await Promise.race([loadingTask.promise, timeoutPromise])

        console.log(`Successfully loaded PDF with strategy: ${strategy.name}`)
        if (strategy.name !== "No Worker") {
          warnings.push(`Used ${strategy.name} loading strategy`)
        }
        break
      } catch (error) {
        console.warn(`Loading strategy ${strategy.name} failed:`, error)
        lastError = error instanceof Error ? error : new Error(String(error))
        continue
      }
    }

    if (!pdf) {
      throw lastError || new Error("All PDF loading strategies failed")
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

    // Enhanced chunking with better structure preservation
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
        processingMethod: "Enhanced PDF.js",
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

        // Add small delay to prevent browser freezing
        if (pageNum % 5 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 10))
        }
      } catch (pageError) {
        failedPages++
        const errorMsg = pageError instanceof Error ? pageError.message : "Unknown error"
        console.warn(`Error processing page ${pageNum}:`, pageError)
        warnings.push(`Page ${pageNum}: Processing error - ${errorMsg}`)
        fullText += `\n\n=== Page ${pageNum} (Error) ===\n[Page processing failed: ${errorMsg}]`
      }
    }

    const averageConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0

    return {
      fullText,
      successfulPages,
      failedPages,
      confidence: averageConfidence,
    }
  }

  private async extractPageTextEnhanced(
    page: any,
    pageNum: number,
  ): Promise<{
    text: string
    confidence: number
  }> {
    try {
      // Enhanced text extraction with better formatting
      const textContent = await page.getTextContent({
        normalizeWhitespace: true,
        disableCombineTextItems: false,
        includeMarkedContent: true,
      })

      if (!textContent?.items || textContent.items.length === 0) {
        return { text: "", confidence: 0 }
      }

      // Enhanced text formatting with structure preservation
      const formattedText = this.formatTextContentEnhanced(textContent)

      // Calculate confidence based on text quality indicators
      const confidence = this.calculateTextConfidence(formattedText, textContent.items.length)

      return {
        text: formattedText,
        confidence,
      }
    } catch (error) {
      console.warn(`Enhanced text extraction failed for page ${pageNum}:`, error)
      return { text: "", confidence: 0 }
    }
  }

  private formatTextContentEnhanced(textContent: any): string {
    if (!textContent?.items) return ""

    let text = ""
    let lastY = null
    let lastX = null
    let lastFontSize = null
    const lines: Array<{ y: number; text: string; fontSize: number }> = []

    // First pass: group text items by line
    for (const item of textContent.items) {
      if (!item.str || item.str.trim() === "") continue

      const currentY = Math.round(item.transform[5])
      const currentX = item.transform[4]
      const fontSize = item.transform[0] || 12

      // Check if this is a new line
      if (lastY === null || Math.abs(currentY - lastY) > 3) {
        lines.push({ y: currentY, text: item.str, fontSize })
      } else {
        // Same line - add to existing line with appropriate spacing
        const lastLine = lines[lines.length - 1]
        const spacing = lastX !== null && currentX - lastX > fontSize ? " " : ""
        lastLine.text += spacing + item.str
      }

      lastY = currentY
      lastX = currentX + (item.width || 0)
      lastFontSize = fontSize
    }

    // Second pass: format lines with structure preservation
    lines.sort((a, b) => b.y - a.y) // Sort by Y position (top to bottom)

    let previousY = null
    let previousFontSize = null

    for (const line of lines) {
      const lineText = line.text.trim()
      if (!lineText) continue

      // Add extra spacing for significant Y gaps (new paragraphs)
      if (previousY !== null && previousY - line.y > 20) {
        text += "\n\n"
      } else if (text && !text.endsWith("\n")) {
        text += "\n"
      }

      // Handle different font sizes (headings, etc.)
      if (previousFontSize !== null && Math.abs(line.fontSize - previousFontSize) > 2) {
        if (line.fontSize > previousFontSize) {
          text += "\n" // Extra space before larger text (headings)
        }
      }

      text += lineText
      previousY = line.y
      previousFontSize = line.fontSize
    }

    // Clean up the text
    return text
      .replace(/\s+/g, " ") // Normalize whitespace
      .replace(/\n\s*\n\s*\n/g, "\n\n") // Normalize paragraph breaks
      .replace(/([.!?])\s*\n\s*([A-Z])/g, "$1\n\n$2") // Ensure paragraph breaks after sentences
      .trim()
  }

  private calculateTextConfidence(text: string, itemCount: number): number {
    if (!text || text.length === 0) return 0

    let confidence = 50 // Base confidence

    // Text length indicator
    if (text.length > 100) confidence += 20
    if (text.length > 500) confidence += 10

    // Word count indicator
    const wordCount = text.split(/\s+/).length
    if (wordCount > 20) confidence += 10
    if (wordCount > 100) confidence += 5

    // Structure indicators
    if (text.includes("\n\n")) confidence += 5 // Paragraphs
    if (/[.!?]/.test(text)) confidence += 5 // Sentences
    if (/[A-Z][a-z]/.test(text)) confidence += 5 // Proper capitalization

    // Item density (more items usually means better extraction)
    const density = itemCount / Math.max(text.length / 100, 1)
    if (density > 5) confidence += 5

    // Penalize for extraction issues
    if (text.includes("�")) confidence -= 10 // Encoding issues
    if (text.length < 50) confidence -= 20 // Too short
    if (!/[a-zA-Z]/.test(text)) confidence -= 30 // No letters

    return Math.max(0, Math.min(100, confidence))
  }

  private determineExtractionQuality(
    successfulPages: number,
    totalPages: number,
    text: string,
    confidence: number,
  ): "high" | "medium" | "low" {
    const successRate = successfulPages / totalPages
    const textDensity = text.length / totalPages
    const avgConfidence = confidence

    if (successRate >= 0.9 && textDensity > 800 && avgConfidence > 80) return "high"
    if (successRate >= 0.7 && textDensity > 400 && avgConfidence > 60) return "medium"
    return "low"
  }

  private detectLanguage(text: string): string {
    const sample = text.slice(0, 2000).toLowerCase()

    const languages = {
      english: [
        "the",
        "and",
        "or",
        "but",
        "in",
        "on",
        "at",
        "to",
        "for",
        "of",
        "with",
        "by",
        "is",
        "are",
        "was",
        "were",
      ],
      spanish: ["el", "la", "de", "que", "y", "en", "un", "es", "se", "no", "te", "lo", "le", "da", "su", "por"],
      french: [
        "le",
        "de",
        "et",
        "à",
        "un",
        "il",
        "être",
        "et",
        "en",
        "avoir",
        "que",
        "pour",
        "dans",
        "ce",
        "son",
        "une",
      ],
      german: [
        "der",
        "die",
        "und",
        "in",
        "den",
        "von",
        "zu",
        "das",
        "mit",
        "sich",
        "des",
        "auf",
        "für",
        "ist",
        "im",
        "dem",
      ],
    }

    let bestMatch = "Unknown"
    let bestScore = 0

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
The enhanced PDF processor encountered an issue while trying to extract text from your document. This can happen for several reasons:

### Common Causes:
1. **Version Conflicts**: PDF.js library version mismatches
2. **Scanned Documents**: The PDF contains images of text rather than actual text
3. **Complex Formatting**: Advanced layouts, tables, or graphics that are difficult to parse
4. **Encrypted Content**: Password-protected or secured documents
5. **File Corruption**: The PDF file may be damaged or incomplete
6. **Browser Compatibility**: Some browsers have limitations with PDF processing

### Recommended Solutions:

#### Immediate Actions:
1. **Try a Different PDF**: Test with a simpler, text-based PDF document
2. **Refresh the Page**: Clear browser cache and reload the application
3. **Different Browser**: Try using Chrome, Firefox, or Safari
4. **Check File Integrity**: Ensure the PDF opens correctly in standard PDF viewers

#### Alternative Processing Methods:
1. **Manual Text Entry**: Copy and paste text directly from a PDF viewer
2. **OCR Tools**: Use dedicated OCR software like Adobe Acrobat or online OCR services
3. **Document Conversion**: Convert to Word (.docx) or plain text (.txt) format
4. **Professional Tools**: Consider specialized PDF processing software

#### Technical Troubleshooting:
1. **Browser Compatibility**: Try using a different web browser
2. **File Size**: Ensure the file is under the size limit
3. **Network Connection**: Check for stable internet connectivity
4. **Clear Cache**: Clear browser cache and try again

## System Information:
- **Processor**: Enhanced PDF.js Engine
- **Browser**: ${navigator.userAgent.split(" ")[0] || "Unknown"}
- **Processing Method**: Client-side text extraction
- **Fallback Status**: Active

## Next Steps:
This fallback document allows you to continue using the system while you resolve the PDF processing issue. You can:

1. Upload a different PDF file
2. Use the manual text input feature
3. Try the suggestions above
4. Contact support if issues persist

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
