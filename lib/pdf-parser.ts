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
  }
}

export class PDFParser {
  private pdfjsLib: any = null
  private isInitialized = false

  constructor() {
    // Don't initialize immediately - do it when needed
  }

  private async initializePDFJS() {
    if (this.isInitialized && this.pdfjsLib) {
      return this.pdfjsLib
    }

    try {
      console.log("Initializing PDF.js...")

      // Use webpack-compatible import
      const pdfjs = await import("pdfjs-dist/webpack")
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

      // Extract text from all pages with individual error handling
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        try {
          console.log(`Processing page ${pageNum}/${pdf.numPages}`)
          const page = await pdf.getPage(pageNum)
          const textContent = await page.getTextContent()

          const pageText = textContent.items
            .map((item: any) => {
              if (item && typeof item === "object" && "str" in item) {
                return item.str
              }
              return ""
            })
            .filter((text) => text.trim().length > 0)
            .join(" ")

          if (pageText.trim()) {
            fullText += `\n\n--- Page ${pageNum} ---\n${pageText}`
            successfulPages++
          }
        } catch (pageError) {
          console.warn(`Error processing page ${pageNum}:`, pageError)
          // Add a placeholder for failed pages
          fullText += `\n\n--- Page ${pageNum} (Processing Error) ---\n[Page content could not be extracted]`
        }
      }

      console.log(`Text extraction complete. Successful pages: ${successfulPages}/${pdf.numPages}`)

      if (!fullText.trim() || successfulPages === 0) {
        throw new Error("No readable text content found in PDF. This might be an image-based PDF.")
      }

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
          throw new Error("This appears to be an image-based PDF. Please use a text-based PDF or convert it first.")
        } else if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
          throw new Error("Network error while processing PDF. Please check your internet connection.")
        }
      }

      // Generic fallback error
      throw new Error("Could not process PDF file. Please try a different file or use manual text input.")
    }
  }

  chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
    if (!text || text.trim().length === 0) {
      return []
    }

    // Clean up the text first
    const cleanText = text.replace(/\s+/g, " ").replace(/\n+/g, "\n").trim()

    const sentences = cleanText.split(/[.!?]+/).filter((s) => s.trim().length > 0)
    const chunks: string[] = []
    let currentChunk = ""

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim()
      if (!trimmedSentence) continue

      const potentialChunk = currentChunk + (currentChunk ? ". " : "") + trimmedSentence

      if (potentialChunk.length <= chunkSize) {
        currentChunk = potentialChunk
      } else {
        if (currentChunk) {
          chunks.push(currentChunk + ".")
        }
        currentChunk = trimmedSentence
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk + ".")
    }

    // Add overlap between chunks
    const overlappedChunks: string[] = []
    for (let i = 0; i < chunks.length; i++) {
      let chunk = chunks[i]

      // Add overlap from previous chunk
      if (i > 0 && overlap > 0) {
        const prevChunk = chunks[i - 1]
        const overlapText = prevChunk.slice(-overlap)
        chunk = overlapText + " " + chunk
      }

      overlappedChunks.push(chunk)
    }

    return overlappedChunks.filter((chunk) => chunk.trim().length > 0)
  }
}
