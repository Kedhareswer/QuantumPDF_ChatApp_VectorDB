import { BrowserOCRProcessor } from "./ocr-processor"
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
    ocrUsed?: boolean
    ocrConfidence?: number
  }
}

export interface ProcessingProgress {
  stage: string
  progress: number
  details?: string
  method?: string
}

export class AdvancedPDFProcessor {
  private pdfjsLib: any = null
  private isInitialized = false
  private workerInitialized = false
  private ocrProcessor: BrowserOCRProcessor
  private chunker: AdvancedChunker
  private onOCRProgress?: (progress: { progress: number; page?: number; totalPages?: number }) => void
  private options: {
    useOCR?: boolean;
    ocrLanguage?: string;
    // Add other options as needed
  } = {
    useOCR: false,
    ocrLanguage: 'eng'
  };

  constructor(options?: {
    useOCR?: boolean;
    ocrLanguage?: string;
    // Add other options as needed
  }) {
    this.options = { ...this.options, ...options };
    this.ocrProcessor = new BrowserOCRProcessor()
    this.chunker = new AdvancedChunker({
      maxChunkSize: 800,
      minChunkSize: 200,
      overlap: 100,
      preserveStructure: true,
      semanticSplitting: true,
    })
    this.initializePDFJS()
  }

  private async initializePDFJS(): Promise<void> {
    if (this.isInitialized) return

    try {
      console.log("Initializing PDF.js library...")

      const pdfjs = await import("pdfjs-dist")
      this.pdfjsLib = pdfjs.default || pdfjs

      if (!this.pdfjsLib?.getDocument) {
        throw new Error("PDF.js getDocument method not available")
      }

      // Configure worker with multiple fallback strategies
      if (typeof window !== "undefined" && this.pdfjsLib.GlobalWorkerOptions) {
        const workerSources = [
          // Try jsdelivr with specific version
          `https://cdn.jsdelivr.net/npm/pdfjs-dist@${this.pdfjsLib.version}/build/pdf.worker.min.js`,
          // Try jsdelivr without version
          "https://cdn.jsdelivr.net/npm/pdfjs-dist/build/pdf.worker.min.js",
          // Try unpkg with version
          `https://unpkg.com/pdfjs-dist@${this.pdfjsLib.version}/build/pdf.worker.min.js`,
          // Try unpkg without version
          "https://unpkg.com/pdfjs-dist/build/pdf.worker.min.js",
          // Try esm.sh
          `https://esm.sh/pdfjs-dist@${this.pdfjsLib.version}/build/pdf.worker.min.js`,
          // Try skypack
          "https://cdn.skypack.dev/pdfjs-dist/build/pdf.worker.min.js",
        ]

        let workerConfigured = false

        for (const workerSrc of workerSources) {
          try {
            console.log(`Trying worker source: ${workerSrc}`)

            // Test if the worker URL is accessible
            const testResponse = await fetch(workerSrc, {
              method: "HEAD",
              mode: "cors",
            }).catch(() => null)

            if (testResponse && testResponse.ok) {
              this.pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc
              this.workerInitialized = true
              workerConfigured = true
              console.log(`PDF.js worker configured successfully with: ${workerSrc}`)
              break
            }
          } catch (error) {
            console.warn(`Worker source failed: ${workerSrc}`, error)
            continue
          }
        }

        if (!workerConfigured) {
          console.warn("All worker sources failed, trying inline worker...")

          try {
            // Create an inline worker as last resort
            const workerBlob = new Blob(
              [
                `
            // Minimal PDF.js worker fallback
            importScripts('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${this.pdfjsLib.version}/pdf.worker.min.js');
          `,
              ],
              { type: "application/javascript" },
            )

            const workerUrl = URL.createObjectURL(workerBlob)
            this.pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl
            this.workerInitialized = true
            console.log("PDF.js worker configured with inline worker")
          } catch (inlineError) {
            console.warn("Inline worker creation failed:", inlineError)
            console.log("Continuing without worker - processing will be slower but functional")
            // Don't set workerInitialized to true, but continue anyway
          }
        }
      }

      this.isInitialized = true
      console.log("PDF.js initialized successfully, version:", this.pdfjsLib.version)
    } catch (error) {
      console.error("Failed to initialize PDF.js:", error)
      throw new Error(
        `PDF.js library initialization failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      )
    }
  }

  async processFile(
    file: File, 
    onProgress?: (progress: ProcessingProgress) => void, 
    onOCRProgress?: (ocrProgress: { progress: number; page?: number; totalPages?: number }) => void
  ): Promise<PDFProcessingResult> {
    this.onOCRProgress = onOCRProgress;
    const startTime = Date.now()

    try {
      this.validateFile(file)

      onProgress?.({
        stage: "Initializing PDF processor...",
        progress: 5,
        method: "PDF.js",
      })

      await this.initializePDFJS()

      // Try primary processing method
      try {
        return await this.processPDFWithPDFJS(file, onProgress, startTime)
      } catch (pdfError) {
        console.warn("PDF.js processing failed:", pdfError)

        // Try server-side processing
        try {
          onProgress?.({
            stage: "Switching to server-side processing...",
            progress: 10,
            method: "Server",
          })
          return await this.processWithServer(file, onProgress, startTime)
        } catch (serverError) {
          console.warn("Server processing failed:", serverError)

          // Skip OCR and go directly to structured fallback
          onProgress?.({
            stage: "Creating structured document...",
            progress: 15,
            method: "Fallback",
          })
          return await this.processWithStructuredFallback(file, onProgress, startTime)
        }
      }
    } catch (error) {
      console.error("All PDF processing methods failed:", error)
      throw new Error(`PDF processing failed: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  private validateFile(file: File): void {
    if (!file) {
      throw new Error("No file provided")
    }

    if (file.type !== "application/pdf") {
      throw new Error("File must be a PDF")
    }

    if (file.size > 50 * 1024 * 1024) {
      throw new Error("File size exceeds 50MB limit")
    }

    if (file.size === 0) {
      throw new Error("File is empty")
    }
  }

  private async processPDFWithPDFJS(
    file: File,
    onProgress?: (progress: ProcessingProgress) => void,
    startTime: number = Date.now(),
  ): Promise<PDFProcessingResult> {
    onProgress?.({
      stage: "Loading PDF document...",
      progress: 10,
      method: "PDF.js",
    })

    const arrayBuffer = await file.arrayBuffer()

    onProgress?.({
      stage: "Parsing PDF structure...",
      progress: 20,
      method: "PDF.js",
    })

    // Create loading task with comprehensive options and worker fallback
    const loadingOptions = {
      data: arrayBuffer,
      useWorkerFetch: this.workerInitialized,
      isEvalSupported: false,
      useSystemFonts: true,
      stopAtErrors: false,
      maxImageSize: 1024 * 1024,
      cMapPacked: true,
      disableAutoFetch: !this.workerInitialized, // Disable auto-fetch if no worker
      disableStream: !this.workerInitialized, // Disable streaming if no worker
      standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${this.pdfjsLib.version}/standard_fonts/`,
    }

    let loadingTask
    try {
      loadingTask = this.pdfjsLib.getDocument(loadingOptions)
    } catch (loadingError) {
      console.warn("Failed to create loading task with worker, trying without worker:", loadingError)

      // Retry without worker-specific options
      const fallbackOptions = {
        data: arrayBuffer,
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true,
        stopAtErrors: false,
        maxImageSize: 512 * 1024, // Smaller image size for non-worker mode
        cMapPacked: false,
        disableAutoFetch: true,
        disableStream: true,
      }

      loadingTask = this.pdfjsLib.getDocument(fallbackOptions)
    }

    const pdf = await loadingTask.promise

    onProgress?.({
      stage: "Extracting document metadata...",
      progress: 30,
      method: "PDF.js",
    })

    let metadata: any = {}
    try {
      const metadataResult = await pdf.getMetadata()
      metadata = metadataResult.info || {}
    } catch (metaError) {
      console.warn("Could not extract metadata:", metaError)
    }

    onProgress?.({
      stage: "Extracting text from pages...",
      progress: 40,
      method: "PDF.js",
    })

    let fullText = ""
    let successfulPages = 0
    let failedPages = 0
    const totalPages = pdf.numPages
    const ocrUsed = false
    const totalOcrConfidence = 0
    const ocrPageCount = 0

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      try {
        const progress = 40 + (pageNum / totalPages) * 40
        onProgress?.({
          stage: `Processing page ${pageNum} of ${totalPages}...`,
          progress,
          method: "PDF.js",
          details: `${successfulPages} pages processed successfully${!this.workerInitialized ? " (no worker)" : ""}`,
        })

        const page = await pdf.getPage(pageNum)

        // Use simpler text extraction options when no worker is available
        const textContentOptions = this.workerInitialized
          ? {
              normalizeWhitespace: true,
              disableCombineTextItems: false,
            }
          : {
              normalizeWhitespace: true,
              disableCombineTextItems: true, // More conservative when no worker
            }

        const textContent = await page.getTextContent(textContentOptions)
        const pageText = this.extractFormattedText(textContent)

        if (pageText.trim()) {
          fullText += `\n\n=== Page ${pageNum} ===\n${pageText}`
          successfulPages++
        } else {
          // Skip OCR processing - mark as failed page
          failedPages++
          console.warn(`No text found on page ${pageNum} - OCR disabled`)
          fullText += `\n\n=== Page ${pageNum} (No Text) ===\n[This page appears to be image-based. Please use a text-based PDF or manual text entry.]`
        }
      } catch (pageError) {
        failedPages++
        console.warn(`Error processing page ${pageNum}:`, pageError)
        fullText += `\n\n=== Page ${pageNum} (Error) ===\n[Page could not be processed: ${pageError instanceof Error ? pageError.message : "Unknown error"}]`
      }
    }

    onProgress?.({
      stage: "Creating optimized text chunks...",
      progress: 85,
      method: "PDF.js",
    })

    if (!fullText.trim()) {
      throw new Error("No readable text content found in PDF")
    }

    // Use advanced chunking
    const advancedChunks = this.chunker.chunkText(fullText.trim())
    const chunks = advancedChunks.map((chunk) => chunk.content)

    onProgress?.({
      stage: "Finalizing processing...",
      progress: 95,
      method: "PDF.js",
    })

    const processingTime = Date.now() - startTime
    const avgOcrConfidence = ocrPageCount > 0 ? totalOcrConfidence / ocrPageCount : undefined

    return {
      text: fullText.trim(),
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
        pages: totalPages,
        processingMethod: `PDF.js${!this.workerInitialized ? " (no worker)" : ""}`,
        extractionQuality: this.determineExtractionQuality(successfulPages, totalPages, fullText),
        language: this.detectLanguage(fullText),
        fileSize: file.size,
        processingTime,
        successfulPages,
        failedPages,
        ocrUsed,
        ocrConfidence: avgOcrConfidence,
      },
    }
  }

  private extractFormattedText(textContent: any): string {
    if (!textContent?.items) return ""

    let text = ""
    let lastY = null
    let lastX = null

    for (const item of textContent.items) {
      if (!item.str) continue

      // Add line breaks for new lines (different Y coordinates)
      if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
        text += "\n"
      }
      // Add spaces for horizontal gaps
      else if (lastX !== null && item.transform[4] - lastX > 10) {
        text += " "
      }

      text += item.str
      lastY = item.transform[5]
      lastX = item.transform[4] + item.width
    }

    return text
      .replace(/\s+/g, " ")
      .replace(/\n\s*\n/g, "\n\n")
      .trim()
  }

  private async extractTextWithOCR(
    page: any,
    pageNum: number,
    onProgress?: (progress: ProcessingProgress) => void,
  ): Promise<{ text: string; confidence: number }> {
    // Skip OCR processing to avoid version conflicts
    console.warn(`Skipping OCR for page ${pageNum} - OCR disabled`)
    return { text: "", confidence: 0 }
  }

  private async processWithServer(
    file: File,
    onProgress?: (progress: ProcessingProgress) => void,
    startTime: number = Date.now(),
  ): Promise<PDFProcessingResult> {
    onProgress?.({
      stage: "Uploading to server...",
      progress: 20,
      method: "Server",
    })

    const formData = new FormData()
    formData.append("pdf", file)

    const response = await fetch("/api/pdf/extract", {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`Server processing failed: ${response.status} ${response.statusText}`)
    }

    onProgress?.({
      stage: "Server processing document...",
      progress: 60,
      method: "Server",
    })

    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || "Server processing failed")
    }

    onProgress?.({
      stage: "Processing server response...",
      progress: 80,
      method: "Server",
    })

    const processingTime = Date.now() - startTime

    // Use advanced chunking for server results too
    const advancedChunks = this.chunker.chunkText(data.text)
    const chunks = advancedChunks.map((chunk) => chunk.content)

    return {
      text: data.text,
      chunks,
      advancedChunks,
      metadata: {
        ...data.metadata,
        processingMethod: "Server",
        processingTime,
        extractionQuality: this.determineExtractionQuality(1, 1, data.text),
        language: this.detectLanguage(data.text),
        fileSize: file.size,
      },
    }
  }

  private async processWithOCR(
    file: File,
    onProgress?: (progress: ProcessingProgress) => void,
    startTime: number = Date.now(),
  ): Promise<PDFProcessingResult> {
    onProgress?.({
      stage: "Preparing PDF for OCR processing...",
      progress: 20,
      method: "OCR",
    })

    try {
      // Check if OCR should be used
      const useOCR = this.ocrProcessor && (this.options?.useOCR || false)

      if (!useOCR) {
        throw new Error("OCR processor not available - Tesseract.js initialization failed")
      }

      // Convert PDF to images and process with OCR
      const arrayBuffer = await file.arrayBuffer()

      // Use simpler PDF loading for OCR processing
      const loadingTask = this.pdfjsLib.getDocument({
        data: arrayBuffer,
        useWorkerFetch: false,
        disableAutoFetch: true,
        disableStream: true,
      })

      const pdf = await loadingTask.promise

      let fullText = ""
      let totalConfidence = 0
      let pageCount = 0
      let successfulPages = 0
      let failedPages = 0

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        try {
          onProgress?.({
            stage: `OCR processing page ${pageNum} of ${pdf.numPages}...`,
            progress: 20 + (pageNum / pdf.numPages) * 60,
            method: "OCR",
          })

          const page = await pdf.getPage(pageNum)
          const viewport = page.getViewport({ scale: 1.5 }) // Reduced scale for better performance
          const canvas = document.createElement("canvas")
          const context = canvas.getContext("2d")!
          canvas.height = viewport.height
          canvas.width = viewport.width

          await page.render({ canvasContext: context, viewport }).promise

          const ocrResult = await this.ocrProcessor.processCanvas(canvas)
          // Update progress after OCR processing
          this.onOCRProgress?.({
            progress: 100,
            page: pageNum,
            totalPages: pdf.numPages
          })

          if (ocrResult.text.trim() && !ocrResult.text.includes("[OCR processing failed")) {
            fullText += `\n\n=== Page ${pageNum} (OCR) ===\n${ocrResult.text}`
            totalConfidence += ocrResult.confidence
            pageCount++
            successfulPages++
          } else {
            failedPages++
            console.warn(`OCR failed for page ${pageNum}`)
          }
        } catch (pageError) {
          failedPages++
          console.warn(`Error processing page ${pageNum} with OCR:`, pageError)
          fullText += `\n\n=== Page ${pageNum} (OCR Error) ===\n[Page could not be processed with OCR]`
        }
      }

      onProgress?.({
        stage: "Creating optimized chunks from OCR text...",
        progress: 85,
        method: "OCR",
      })

      // If no text was extracted, provide a meaningful fallback
      if (!fullText.trim() || pageCount === 0) {
        fullText = `# OCR Processing Report: ${file.name}

## Processing Summary
OCR processing was attempted but could not extract readable text from this PDF.

### Possible Reasons:
- The PDF contains complex layouts or formatting
- The image quality is too low for reliable text recognition
- The document uses fonts or languages not well supported by OCR
- The PDF is already text-based and doesn't require OCR

### Recommendations:
1. Try using a different PDF processing method
2. Ensure the PDF has good image quality if it's scanned
3. Consider using professional OCR software for complex documents
4. Check if the PDF is text-based rather than image-based

**File**: ${file.name}
**Pages Processed**: ${pdf.numPages}
**Successful Pages**: ${successfulPages}
**Failed Pages**: ${failedPages}
**Processing Time**: ${((Date.now() - startTime) / 1000).toFixed(2)} seconds`
      }

      const advancedChunks = this.chunker.chunkText(fullText.trim())
      const chunks = advancedChunks.map((chunk) => chunk.content)

      const processingTime = Date.now() - startTime
      const avgConfidence = pageCount > 0 ? totalConfidence / pageCount : 0

      return {
        text: fullText.trim(),
        chunks,
        advancedChunks,
        metadata: {
          title: file.name,
          author: "OCR Processor",
          subject: "OCR extracted content",
          pages: pdf.numPages,
          processingMethod: "OCR",
          extractionQuality: avgConfidence > 80 ? "high" : avgConfidence > 60 ? "medium" : "low",
          language: this.detectLanguage(fullText),
          fileSize: file.size,
          processingTime,
          successfulPages,
          failedPages,
          ocrUsed: true,
          ocrConfidence: avgConfidence,
        },
      }
    } catch (error) {
      console.error("OCR processing failed:", error)

      // Instead of throwing, return a fallback result
      const processingTime = Date.now() - startTime
      const fallbackText = `# OCR Processing Failed: ${file.name}

## Error Details
OCR processing encountered an error: ${error instanceof Error ? error.message : "Unknown error"}

## Alternative Solutions
1. **Try Standard PDF Processing**: Use the regular PDF text extraction method
2. **Check File Format**: Ensure the file is a valid PDF
3. **File Size**: Large files may cause processing issues
4. **Browser Compatibility**: Try using a different browser
5. **Manual Text Entry**: Consider manually entering the text content

**File**: ${file.name}
**Processing Time**: ${(processingTime / 1000).toFixed(2)} seconds
**Error**: ${error instanceof Error ? error.message : "Unknown error"}`

      const advancedChunks = this.chunker.chunkText(fallbackText)
      const chunks = advancedChunks.map((chunk) => chunk.content)

      return {
        text: fallbackText,
        chunks,
        advancedChunks,
        metadata: {
          title: file.name,
          author: "OCR Processor",
          subject: "OCR processing failed",
          pages: 1,
          processingMethod: "OCR (Failed)",
          extractionQuality: "low" as const,
          language: "English",
          fileSize: file.size,
          processingTime,
          successfulPages: 0,
          failedPages: 1,
          ocrUsed: false,
        },
      }
    }
  }

  private async processWithStructuredFallback(
    file: File,
    onProgress?: (progress: ProcessingProgress) => void,
    startTime: number = Date.now(),
  ): Promise<PDFProcessingResult> {
    onProgress?.({
      stage: "Creating structured fallback document...",
      progress: 50,
      method: "Fallback",
    })

    const processingTime = Date.now() - startTime

    const fallbackText = `
# PDF Processing Report: ${file.name}

## Document Information
- **Filename**: ${file.name}
- **File Size**: ${(file.size / 1024 / 1024).toFixed(2)} MB
- **Processing Date**: ${new Date().toLocaleString()}
- **Processing Method**: Structured Fallback

## Processing Status
This PDF document could not be processed using standard text extraction methods. This typically occurs with:

### Common Scenarios:
1. **Image-based PDFs**: Documents created by scanning physical pages
2. **Complex layouts**: PDFs with advanced formatting, tables, or graphics
3. **Encrypted content**: Password-protected or secured documents
4. **Corrupted files**: PDFs with structural integrity issues
5. **Unsupported formats**: Non-standard PDF specifications

### Recommended Solutions:
1. **OCR Processing**: Use Optical Character Recognition tools like Adobe Acrobat, ABBYY FineReader, or online OCR services
2. **Format Conversion**: Convert to Word (.docx) or plain text (.txt) using PDF converters
3. **Manual Extraction**: Copy and paste text directly from a PDF viewer
4. **Alternative Sources**: Obtain the document in a different format if possible
5. **Professional Tools**: Use specialized PDF processing software for complex documents

### Technical Details:
- **Browser Compatibility**: Ensure you're using a modern browser (Chrome, Firefox, Safari, Edge)
- **File Integrity**: Verify the PDF opens correctly in standard PDF viewers
- **Security Settings**: Check if the PDF has copy/text extraction restrictions
- **Network Issues**: Ensure stable internet connection for cloud processing

## Next Steps:
1. Try the manual text input option to create a searchable document
2. Use external tools to convert the PDF to a text-based format
3. Contact support if you continue experiencing issues
4. Upload a different PDF file for testing

This fallback document ensures you can still interact with the system while resolving PDF processing challenges.
    `.trim()

    const advancedChunks = this.chunker.chunkText(fallbackText)
    const chunks = advancedChunks.map((chunk) => chunk.content)

    return {
      text: fallbackText,
      chunks,
      advancedChunks,
      metadata: {
        title: file.name,
        author: "PDF Processor",
        subject: "Fallback processing result",
        pages: 1,
        processingMethod: "Structured Fallback",
        extractionQuality: "low" as const,
        language: "English",
        fileSize: file.size,
        processingTime,
        successfulPages: 0,
        failedPages: 1,
      },
    }
  }

  private determineExtractionQuality(
    successfulPages: number,
    totalPages: number,
    text: string,
  ): "high" | "medium" | "low" {
    const successRate = successfulPages / totalPages
    const textDensity = text.length / totalPages

    if (successRate >= 0.9 && textDensity > 500) return "high"
    if (successRate >= 0.7 && textDensity > 200) return "medium"
    return "low"
  }

  private detectLanguage(text: string): string {
    const sample = text.slice(0, 1000).toLowerCase()

    const englishWords = ["the", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by"]
    const englishCount = englishWords.reduce((count, word) => count + (sample.split(word).length - 1), 0)

    if (englishCount > 5) return "English"
    return "Unknown"
  }
}
