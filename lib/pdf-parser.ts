import { AdvancedChunker } from './advanced-chunking';
import { BrowserOCRProcessor } from './ocr-processor';

export interface PDFContent {
  text: string
  metadata: {
    title?: string
    author?: string
    subject?: string
    creator?: string
    producer?: string
    creationDate?: Date
    modificationDate?: Date
    pages: number
    ocrUsed?: boolean
    ocrPages?: number
    textPages?: number
    ocrConfidence?: number
  }
}

export class PDFParser {
  private pdfjsLib: unknown = null
  private isInitialized = false
  private ocrProcessor: BrowserOCRProcessor | null = null
  private ocrAvailable: boolean = false

  constructor() {
    // Don't initialize immediately - do it when needed
    // Try to initialize OCR processor (non-blocking)
    this.initializeOCR().catch(() => {
      console.log("OCR not available - will use text extraction only")
    })
  }

  /**
   * Initialize OCR processor (non-blocking, fails gracefully)
   */
  private async initializeOCR(): Promise<void> {
    try {
      // Check if we're in browser environment
      if (typeof window === 'undefined') {
        return
      }

      this.ocrProcessor = new BrowserOCRProcessor('eng', true) // Enable dual OCR
      this.ocrAvailable = true
      console.log("Dual OCR processor initialized (Tesseract + PaddleOCR)")
      
      // Log which engines are available
      setTimeout(async () => {
        if (this.ocrProcessor) {
          const tesseractAvailable = this.ocrProcessor.isTesseractAvailable()
          const paddleOCRAvailable = this.ocrProcessor.isPaddleOCRAvailable()
          console.log(`OCR Engines: Tesseract=${tesseractAvailable}, PaddleOCR=${paddleOCRAvailable}`)
        }
      }, 1000)
    } catch (error) {
      console.warn("OCR initialization failed (will use text extraction only):", error)
      this.ocrAvailable = false
      this.ocrProcessor = null
    }
  }

  private async initializePDFJS() {
    if (this.isInitialized && this.pdfjsLib) {
      return this.pdfjsLib
    }

    try {
      console.log("Initializing PDF.js...")

      // Use dynamic import for PDF.js
      const pdfjs = await import('pdfjs-dist')
      this.pdfjsLib = pdfjs

      console.log("PDF.js loaded, version:", this.pdfjsLib.version)

      // Configure worker using CDN
      if (typeof window !== "undefined" && this.pdfjsLib.GlobalWorkerOptions) {
        try {
          // Use CDN-hosted worker
          this.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${this.pdfjsLib.version}/pdf.worker.min.js`
          console.log("PDF.js worker configured from CDN")
        } catch (workerError) {
          console.warn("Could not configure PDF.js worker:", workerError)
        }
      }

      this.isInitialized = true
      return this.pdfjsLib
    } catch (error) {
      console.error("Failed to initialize PDF.js:", error)
      throw new Error("PDF.js library could not be loaded. Please check your internet connection.")
    }
  }

  async extractText(file: File): Promise<PDFContent> {
    try {
      console.log("Starting PDF text extraction for:", file.name)

      // Initialize PDF.js first
      const pdfjsLib = await this.initializePDFJS()

      // Check if getDocument function exists
      if (!pdfjsLib.getDocument) {
        console.error("getDocument function not found in PDF.js library")
        console.log("Available PDF.js methods:", Object.keys(pdfjsLib))
        throw new Error("PDF.js getDocument function not available")
      }

      const arrayBuffer = await file.arrayBuffer()
      console.log("File loaded into array buffer, size:", arrayBuffer.byteLength)

      // Create loading task with minimal configuration
      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        // Minimal configuration to avoid issues
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true,
        stopAtErrors: false,
        cMapUrl: "https://unpkg.com/pdfjs-dist/cmaps/",
        cMapPacked: true,
      })

      console.log("Loading PDF document...")
      const pdf = await loadingTask.promise
      console.log("PDF loaded successfully, pages:", pdf.numPages)

      let metadata
      try {
        metadata = await pdf.getMetadata()
        console.log("PDF metadata extracted")
      } catch (metaError) {
        console.warn("Could not extract metadata:", metaError)
        metadata = { info: {} }
      }

      let fullText = ""
      let successfulPages = 0
      let textPages = 0
      let ocrPages = 0
      let totalOcrConfidence = 0
      let ocrUsed = false

      // Extract text from all pages with individual error handling
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        try {
          console.log(`Processing page ${pageNum}/${pdf.numPages}`)
          const page = await pdf.getPage(pageNum)
          const textContent = await page.getTextContent()

          const pageText = textContent.items
            .map((item: unknown) => {
              if (item && typeof item === 'object' && 'str' in item) {
                return (item as { str: string }).str;
              }
              return '';
            })
            .filter((text: string) => text.trim().length > 0)
            .join(' ')

          // If page has text, use it
          if (pageText.trim()) {
            fullText += `\n\n--- Page ${pageNum} ---\n${pageText}`
            successfulPages++
            textPages++
          } else {
            // No text found - try OCR if available
            console.log(`Page ${pageNum} has no extractable text - attempting OCR...`)
            
            if (this.ocrAvailable && this.ocrProcessor) {
              try {
                // Render page to canvas for OCR
                const viewport = page.getViewport({ scale: 2.0 }) // Higher scale for better OCR
                const canvas = document.createElement('canvas')
                const context = canvas.getContext('2d')
                
                if (context) {
                  canvas.width = viewport.width
                  canvas.height = viewport.height
                  
                  await page.render({
                    canvasContext: context,
                    viewport: viewport
                  }).promise
                  
                  // Process with dual OCR (Tesseract + PaddleOCR)
                  console.log(`Running dual OCR on page ${pageNum}...`)
                  const ocrResult = await this.ocrProcessor.processImage(canvas)
                  
                  if (ocrResult.text && ocrResult.text.trim() && !ocrResult.text.includes("OCR processing failed")) {
                    fullText += `\n\n--- Page ${pageNum} (OCR) ---\n${ocrResult.text}`
                    successfulPages++
                    ocrPages++
                    totalOcrConfidence += ocrResult.confidence
                    ocrUsed = true
                    console.log(`✅ OCR extracted text from page ${pageNum} (confidence: ${ocrResult.confidence.toFixed(1)}%)`)
                  } else {
                    console.warn(`OCR found no text on page ${pageNum}`)
                    fullText += `\n\n--- Page ${pageNum} (No Text/OCR) ---\n[This page appears to be image-based with no readable text]`
                  }
                } else {
                  throw new Error("Could not create canvas context")
                }
              } catch (ocrError) {
                console.warn(`OCR failed for page ${pageNum}:`, ocrError)
                fullText += `\n\n--- Page ${pageNum} (OCR Failed) ---\n[Page content could not be extracted via OCR]`
              }
            } else {
              // OCR not available
              console.warn(`Page ${pageNum} has no text and OCR is not available`)
              fullText += `\n\n--- Page ${pageNum} (Image-based, OCR not available) ---\n[This page appears to be image-based. Install tesseract.js for OCR support.]`
            }
          }
        } catch (pageError) {
          console.warn(`Error processing page ${pageNum}:`, pageError)
          // Try OCR as fallback if text extraction failed
          if (this.ocrAvailable && this.ocrProcessor) {
            try {
              const page = await pdf.getPage(pageNum)
              const viewport = page.getViewport({ scale: 2.0 })
              const canvas = document.createElement('canvas')
              const context = canvas.getContext('2d')
              
              if (context) {
                canvas.width = viewport.width
                canvas.height = viewport.height
                await page.render({ canvasContext: context, viewport: viewport }).promise
                
                const ocrResult = await this.ocrProcessor.processImage(canvas)
                if (ocrResult.text && ocrResult.text.trim()) {
                  const engineLabel = ocrResult.engine === 'hybrid' 
                    ? `Dual OCR Fallback (${ocrResult.engine})`
                    : `OCR Fallback (${ocrResult.engine || 'tesseract'})`
                  
                  fullText += `\n\n--- Page ${pageNum} (${engineLabel}) ---\n${ocrResult.text}`
                  successfulPages++
                  ocrPages++
                  totalOcrConfidence += ocrResult.confidence
                  ocrUsed = true
                } else {
                  fullText += `\n\n--- Page ${pageNum} (Processing Error) ---\n[Page content could not be extracted]`
                }
              }
            } catch (ocrFallbackError) {
              console.warn(`OCR fallback also failed for page ${pageNum}:`, ocrFallbackError)
              fullText += `\n\n--- Page ${pageNum} (Processing Error) ---\n[Page content could not be extracted]`
            }
          } else {
          fullText += `\n\n--- Page ${pageNum} (Processing Error) ---\n[Page content could not be extracted]`
          }
        }
      }

      console.log(`Text extraction complete. Successful pages: ${successfulPages}/${pdf.numPages}`)
      if (ocrUsed) {
        console.log(`OCR was used on ${ocrPages} page(s) (${textPages} pages had extractable text)`)
        const avgOcrConfidence = ocrPages > 0 ? totalOcrConfidence / ocrPages : 0
        console.log(`Average OCR confidence: ${avgOcrConfidence.toFixed(1)}%`)
      }

      if (!fullText.trim() || successfulPages === 0) {
        throw new Error("No readable text content found in PDF. This might be an image-based PDF.")
      }

      const avgOcrConfidence = ocrPages > 0 ? totalOcrConfidence / ocrPages : undefined

      return {
        text: fullText.trim(),
        metadata: {
          title: metadata.info?.Title || file.name,
          author: metadata.info?.Author || "Unknown",
          subject: metadata.info?.Subject || "",
          creator: metadata.info?.Creator || "",
          producer: metadata.info?.Producer || "",
          creationDate: metadata.info?.CreationDate ? new Date(metadata.info.CreationDate) : undefined,
          modificationDate: metadata.info?.ModDate ? new Date(metadata.info.ModDate) : undefined,
          pages: pdf.numPages,
          ocrUsed,
          ocrPages,
          textPages,
          ocrConfidence: avgOcrConfidence,
        },
      }
    } catch (error) {
      console.error("Error parsing PDF:", error)

      // Provide more specific error messages based on the error type
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase()

        if (errorMessage.includes("getdocument") || errorMessage.includes("not a function")) {
          throw new Error("PDF.js library loading issue. Please refresh the page and try again.")
        } else if (errorMessage.includes("worker") || errorMessage.includes("script")) {
          throw new Error(
            "PDF processing failed due to browser security restrictions. Please try a different browser or disable ad blockers.",
          )
        } else if (errorMessage.includes("invalid") || errorMessage.includes("corrupt")) {
          throw new Error("The PDF file appears to be corrupted or invalid. Please try a different file.")
        } else if (errorMessage.includes("password") || errorMessage.includes("encrypted")) {
          throw new Error("Password-protected PDFs are not supported. Please use an unprotected PDF.")
        } else if (errorMessage.includes("no readable text") || errorMessage.includes("image-based")) {
          // Updated message - OCR is now attempted automatically
          throw new Error("This PDF could not be processed. The document may be:\n• Fully image-based with poor image quality\n• Corrupted or encrypted\n• Using unsupported formats\n\nIf OCR was attempted, it may have failed due to image quality. Try using a higher quality scan or a text-based PDF.")
        } else if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
          throw new Error("Network error while processing PDF. Please check your internet connection.")
        }
      }

      // Generic fallback error
      throw new Error("Could not process PDF file. Please try a different file or use manual text input.")
    }
  }

  chunkText(text: string, chunkSize = 1000, overlap = 100): string[] {
    if (!text || text.trim().length === 0) {
      return [];
    }

    // Delegate to AdvancedChunker to preserve structure (code, tables, images)
    const chunker = new AdvancedChunker({
      maxChunkSize: chunkSize,
      minChunkSize: Math.max(100, Math.floor(chunkSize * 0.25)),
      overlap,
      preserveStructure: true,
      semanticSplitting: true,
      documentAware: true,
      adaptiveThreshold: true,
    })

    const advanced = chunker.chunkText(text)
    // Return plain strings for embedding pipeline compatibility
    return advanced.map(c => c.content).filter(c => c.trim().length > 0)
  }

  /**
   * Cleanup OCR resources
   */
  async cleanup(): Promise<void> {
    if (this.ocrProcessor) {
      await this.ocrProcessor.cleanup()
    }
  }
}
