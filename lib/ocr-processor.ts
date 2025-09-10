// Browser-compatible OCR processor using Tesseract.js

export interface OCRResult {
  text: string
  confidence: number
  language?: string
}

export class BrowserOCRProcessor {
  private tesseract: any = null
  private isInitialized = false

  private async initializeTesseract() {
    if (this.isInitialized && this.tesseract) {
      return this.tesseract
    }

    try {
      // Use eval to avoid TypeScript checking at compile time
      const tesseractModule = await eval('import("tesseract.js")').catch(() => null)
      
      if (!tesseractModule) {
        throw new Error("Tesseract.js is not available")
      }
      
      const worker = await tesseractModule.createWorker('eng', 1, {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`)
          }
        }
      })

      this.tesseract = worker
      this.isInitialized = true
      console.log("Tesseract.js OCR worker initialized successfully")
      return worker
    } catch (error) {
      console.error("OCR module not available:", error)
      throw new Error("OCR functionality is not available in this configuration.")
    }
  }

  async processImage(imageData: ImageData | Blob): Promise<OCRResult> {
    try {
      const worker = await this.initializeTesseract()
      
      console.log("Starting OCR processing...")
      const { data } = await worker.recognize(imageData)
      
      return {
        text: data.text || "No text detected in the image.",
        confidence: data.confidence || 0,
        language: "eng",
      }
    } catch (error) {
      console.error("OCR processing failed:", error)

    return {
        text: "OCR processing failed. This might be due to:\n" +
              "• Poor image quality\n" +
              "• Unsupported text format\n" +
              "• Network connectivity issues\n" +
              "Please try with a clearer image or check your internet connection.",
      confidence: 0,
      language: "unknown",
      }
    }
  }

  async processCanvas(canvas: HTMLCanvasElement): Promise<OCRResult> {
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      throw new Error("Cannot get canvas context")
    }

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    return this.processImage(imageData)
  }

  async processFile(file: File): Promise<OCRResult> {
    try {
      // Convert file to image data
      return new Promise((resolve, reject) => {
        const img = new Image()
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        if (!ctx) {
          reject(new Error("Cannot create canvas context"))
          return
        }

        img.onload = async () => {
          canvas.width = img.width
          canvas.height = img.height
          ctx.drawImage(img, 0, 0)
          
          try {
            const result = await this.processCanvas(canvas)
            resolve(result)
          } catch (error) {
            reject(error)
          }
        }

        img.onerror = () => {
          reject(new Error("Failed to load image file"))
        }

        const url = URL.createObjectURL(file)
        img.src = url
      })
    } catch (error) {
      console.error("OCR file processing failed:", error)
      return {
        text: "Failed to process image file. Please ensure the file is a valid image format (PNG, JPG, etc.)",
        confidence: 0,
        language: "unknown",
      }
    }
  }

  async cleanup() {
    if (this.tesseract && this.isInitialized) {
      try {
        await this.tesseract.terminate()
        this.isInitialized = false
        this.tesseract = null
        console.log("OCR worker terminated successfully")
      } catch (error) {
        console.error("Error terminating OCR worker:", error)
      }
    }
  }
}
