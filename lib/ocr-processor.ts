// Browser-compatible OCR processor using Tesseract.js and PaddleOCR.js

export interface OCRResult {
  text: string
  confidence: number
  language?: string
  engine?: 'tesseract' | 'paddleocr' | 'hybrid'
}

export interface DualOCRResult extends OCRResult {
  tesseractResult?: OCRResult
  paddleOCRResult?: OCRResult
  selectedEngine: 'tesseract' | 'paddleocr' | 'hybrid'
}

export class BrowserOCRProcessor {
  private tesseract: any = null
  private paddleOCR: any = null
  private tesseractInitialized = false
  private paddleOCRInitialized = false
  private paddleOCRAvailable = false
  private language: string
  private useDualOCR: boolean

  constructor(language = "eng", useDualOCR = true) {
    this.language = language
    this.useDualOCR = useDualOCR
    // Try to initialize PaddleOCR (non-blocking)
    this.initializePaddleOCR().catch(() => {
      console.log("PaddleOCR not available - will use Tesseract only")
    })
  }

  setLanguage(language: string) {
    if (language && language !== this.language) {
      this.language = language
      // Reinitialize workers with new language on next use
      this.tesseractInitialized = false
      this.paddleOCRInitialized = false
      this.tesseract = null
      this.paddleOCR = null
    }
  }

  /**
   * Initialize PaddleOCR (non-blocking, fails gracefully)
   */
  private async initializePaddleOCR(): Promise<void> {
    if (this.paddleOCRInitialized && this.paddleOCR) {
      return
    }

    try {
      // Check if we're in browser environment
      if (typeof window === 'undefined') {
        return
      }

      // Try to import PaddleOCR.js or alternatives
      // Note: PaddleOCR.js is not available as a standard npm package
      // Users can manually install alternatives or the system will use Tesseract only
      const alternatives = [
        'paddleocr.js',
        '@paddle-js-models/ocr',
        'paddleocr-web',
        '@paddlejs/ocr'
      ]
      
      let paddleOCRModule = null
      let usedPackage = null
      
      for (const pkg of alternatives) {
        try {
          paddleOCRModule = await eval(`import("${pkg}")`).catch(() => null)
          if (paddleOCRModule) {
            usedPackage = pkg
            break
          }
        } catch {
          continue
        }
      }
      
      if (!paddleOCRModule) {
        throw new Error("PaddleOCR is not available. Install an alternative package or use Tesseract only.")
      }

      // Initialize PaddleOCR
      // PaddleOCR.js API may vary, so we handle different initialization patterns
      if (paddleOCRModule.default) {
        this.paddleOCR = new paddleOCRModule.default({ lang: this.language })
      } else if (paddleOCRModule.PaddleOCR) {
        this.paddleOCR = new paddleOCRModule.PaddleOCR({ lang: this.language })
      } else if (typeof paddleOCRModule === 'function') {
        this.paddleOCR = paddleOCRModule({ lang: this.language })
      } else {
        this.paddleOCR = paddleOCRModule
      }

      this.paddleOCRAvailable = true
      this.paddleOCRInitialized = true
      console.log(`PaddleOCR initialized successfully${usedPackage ? ` (using ${usedPackage})` : ''}`)
    } catch (error) {
      console.warn("PaddleOCR initialization failed (will use Tesseract only):", error)
      this.paddleOCRAvailable = false
      this.paddleOCR = null
      this.paddleOCRInitialized = false
    }
  }

  private async initializeTesseract() {
    if (this.tesseractInitialized && this.tesseract) {
      return this.tesseract
    }

    try {
      // Use eval to avoid TypeScript checking at compile time
      const tesseractModule = await eval('import("tesseract.js")').catch(() => null)
      
      if (!tesseractModule) {
        throw new Error("Tesseract.js is not available")
      }
      
      const worker = await tesseractModule.createWorker(this.language, 1, {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            console.log(`Tesseract OCR Progress: ${Math.round(m.progress * 100)}%`)
          }
        }
      })

      this.tesseract = worker
      this.tesseractInitialized = true
      console.log("Tesseract.js OCR worker initialized successfully")
      return worker
    } catch (error) {
      console.error("Tesseract.js module not available:", error)
      throw new Error("Tesseract.js OCR functionality is not available in this configuration.")
    }
  }

  /**
   * Process image with Tesseract.js
   */
  private async processWithTesseract(imageData: ImageData | Blob | HTMLCanvasElement): Promise<OCRResult> {
    try {
      const worker = await this.initializeTesseract()
      
      // Handle different input types
      let input: ImageData | Blob
      if (imageData instanceof HTMLCanvasElement) {
        const ctx = imageData.getContext("2d")
        if (!ctx) throw new Error("Cannot get canvas context")
        input = ctx.getImageData(0, 0, imageData.width, imageData.height)
      } else {
        input = imageData
      }
      
      console.log("Starting Tesseract OCR processing...")
      const { data } = await worker.recognize(input)
      
      return {
        text: data.text || "No text detected in the image.",
        confidence: data.confidence || 0,
        language: this.language,
        engine: 'tesseract'
      }
    } catch (error) {
      console.error("Tesseract OCR processing failed:", error)
      return {
        text: "",
        confidence: 0,
        language: this.language,
        engine: 'tesseract'
      }
    }
  }

  /**
   * Process image with PaddleOCR.js
   */
  private async processWithPaddleOCR(canvas: HTMLCanvasElement): Promise<OCRResult> {
    if (!this.paddleOCRAvailable || !this.paddleOCR) {
      throw new Error("PaddleOCR is not available")
    }

    try {
      await this.initializePaddleOCR()
      
      if (!this.paddleOCR) {
        throw new Error("PaddleOCR not initialized")
      }

      console.log("Starting PaddleOCR processing...")
      
      // Convert canvas to image data URL or blob
      const imageDataUrl = canvas.toDataURL('image/png')
      
      // PaddleOCR.js API may vary - try different methods
      let result: any
      
      if (typeof this.paddleOCR.ocr === 'function') {
        result = await this.paddleOCR.ocr(imageDataUrl)
      } else if (typeof this.paddleOCR.recognize === 'function') {
        result = await this.paddleOCR.recognize(imageDataUrl)
      } else if (typeof this.paddleOCR === 'function') {
        result = await this.paddleOCR(imageDataUrl)
      } else {
        throw new Error("Unknown PaddleOCR API")
      }

      // Parse PaddleOCR result (format may vary)
      let text = ""
      let confidence = 0

      if (result.text) {
        text = result.text
        confidence = result.confidence || result.score || 0
      } else if (Array.isArray(result)) {
        // PaddleOCR often returns array of {text, confidence}
        text = result.map((r: any) => r.text || r[0] || '').join(' ')
        const confidences = result.map((r: any) => r.confidence || r[1] || 0).filter((c: number) => c > 0)
        confidence = confidences.length > 0 ? confidences.reduce((a: number, b: number) => a + b, 0) / confidences.length : 0
      } else if (typeof result === 'string') {
        text = result
        confidence = 85 // Default confidence if not provided
      }

      return {
        text: text || "No text detected in the image.",
        confidence: confidence * 100, // Convert to percentage if needed
        language: this.language,
        engine: 'paddleocr'
      }
    } catch (error) {
      console.error("PaddleOCR processing failed:", error)
      return {
        text: "",
        confidence: 0,
        language: this.language,
        engine: 'paddleocr'
      }
    }
  }

  /**
   * Process image with dual OCR (Tesseract + PaddleOCR) and return best result
   */
  async processImage(imageData: ImageData | Blob | HTMLCanvasElement): Promise<OCRResult> {
    // If dual OCR is disabled or PaddleOCR unavailable, use Tesseract only
    if (!this.useDualOCR || !this.paddleOCRAvailable) {
      return this.processWithTesseract(imageData)
    }

    // Convert to canvas if needed for PaddleOCR
    let canvas: HTMLCanvasElement
    if (imageData instanceof HTMLCanvasElement) {
      canvas = imageData
    } else {
      // Create canvas from ImageData or Blob
      canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        throw new Error("Cannot create canvas context")
      }

      if (imageData instanceof ImageData) {
        canvas.width = imageData.width
        canvas.height = imageData.height
        ctx.putImageData(imageData, 0, 0)
      } else {
        // Blob - need to load as image first
        const img = new Image()
        const url = URL.createObjectURL(imageData)
        await new Promise((resolve, reject) => {
          img.onload = () => {
            canvas.width = img.width
            canvas.height = img.height
            ctx.drawImage(img, 0, 0)
            URL.revokeObjectURL(url)
            resolve(null)
          }
          img.onerror = reject
          img.src = url
        })
      }
    }

    // Run both OCR engines in parallel
    console.log("Running dual OCR (Tesseract + PaddleOCR)...")
    const [tesseractResult, paddleOCRResult] = await Promise.allSettled([
      this.processWithTesseract(canvas),
      this.processWithPaddleOCR(canvas)
    ])

    const tesseract = tesseractResult.status === 'fulfilled' ? tesseractResult.value : null
    const paddleOCR = paddleOCRResult.status === 'fulfilled' ? paddleOCRResult.value : null

    // Select best result based on confidence and text length
    if (!tesseract && !paddleOCR) {
      return {
        text: "OCR processing failed. Both Tesseract and PaddleOCR failed.",
        confidence: 0,
        language: this.language,
        engine: 'hybrid'
      }
    }

    if (!tesseract) {
      console.log("✅ Using PaddleOCR result (Tesseract failed)")
      return paddleOCR!
    }

    if (!paddleOCR) {
      console.log("✅ Using Tesseract result (PaddleOCR failed)")
      return tesseract
    }

    // Both succeeded - compare and pick best
    const tesseractScore = this.calculateOCRScore(tesseract)
    const paddleOCRScore = this.calculateOCRScore(paddleOCR)

    console.log(`Tesseract score: ${tesseractScore.toFixed(2)} (confidence: ${tesseract.confidence.toFixed(1)}%, text length: ${tesseract.text.length})`)
    console.log(`PaddleOCR score: ${paddleOCRScore.toFixed(2)} (confidence: ${paddleOCR.confidence.toFixed(1)}%, text length: ${paddleOCR.text.length})`)

    if (paddleOCRScore > tesseractScore) {
      console.log("✅ Using PaddleOCR result (better score)")
      return {
        ...paddleOCR,
        engine: 'hybrid'
      }
    } else {
      console.log("✅ Using Tesseract result (better score)")
      return {
        ...tesseract,
        engine: 'hybrid'
      }
    }
  }

  /**
   * Calculate OCR quality score (confidence + text quality)
   */
  private calculateOCRScore(result: OCRResult): number {
    if (!result.text || result.text.trim().length === 0) {
      return 0
    }

    const confidenceWeight = 0.6
    const textLengthWeight = 0.2
    const textQualityWeight = 0.2

    // Normalize confidence (0-100)
    const confidenceScore = result.confidence / 100

    // Normalize text length (assume 100+ chars is good)
    const textLengthScore = Math.min(1, result.text.length / 100)

    // Text quality (check for common OCR errors)
    const textQuality = this.assessTextQuality(result.text)

    return (
      confidenceScore * confidenceWeight +
      textLengthScore * textLengthWeight +
      textQuality * textQualityWeight
    )
  }

  /**
   * Assess text quality (detect common OCR errors)
   */
  private assessTextQuality(text: string): number {
    let quality = 1.0

    // Penalize excessive special characters (likely OCR errors)
    const specialCharRatio = (text.match(/[^a-zA-Z0-9\s]/g) || []).length / text.length
    if (specialCharRatio > 0.3) {
      quality -= 0.3
    }

    // Penalize excessive whitespace
    const whitespaceRatio = (text.match(/\s+/g) || []).join('').length / text.length
    if (whitespaceRatio > 0.5) {
      quality -= 0.2
    }

    // Bonus for proper words (dictionary-like)
    const words = text.split(/\s+/).filter(w => w.length > 2)
    const properWords = words.filter(w => /^[a-zA-Z]+$/.test(w)).length
    if (words.length > 0) {
      const properWordRatio = properWords / words.length
      quality += properWordRatio * 0.2
    }

    return Math.max(0, Math.min(1, quality))
  }

  async processCanvas(canvas: HTMLCanvasElement): Promise<OCRResult> {
    // processImage now handles canvas directly, so just pass it through
    return this.processImage(canvas)
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

  /**
   * Get dual OCR result with both engines' outputs
   */
  async processImageDual(imageData: ImageData | Blob | HTMLCanvasElement): Promise<DualOCRResult> {
    // Convert to canvas if needed
    let canvas: HTMLCanvasElement
    if (imageData instanceof HTMLCanvasElement) {
      canvas = imageData
    } else {
      canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error("Cannot create canvas context")

      if (imageData instanceof ImageData) {
        canvas.width = imageData.width
        canvas.height = imageData.height
        ctx.putImageData(imageData, 0, 0)
      } else {
        const img = new Image()
        const url = URL.createObjectURL(imageData)
        await new Promise((resolve, reject) => {
          img.onload = () => {
            canvas.width = img.width
            canvas.height = img.height
            ctx.drawImage(img, 0, 0)
            URL.revokeObjectURL(url)
            resolve(null)
          }
          img.onerror = reject
          img.src = url
        })
      }
    }

    // Run both in parallel
    const [tesseractResult, paddleOCRResult] = await Promise.allSettled([
      this.processWithTesseract(canvas),
      this.paddleOCRAvailable ? this.processWithPaddleOCR(canvas) : Promise.resolve(null)
    ])

    const tesseract = tesseractResult.status === 'fulfilled' ? tesseractResult.value : null
    const paddleOCR = paddleOCRResult.status === 'fulfilled' ? paddleOCRResult.value : null

    // Select best result
    let selectedEngine: 'tesseract' | 'paddleocr' | 'hybrid' = 'tesseract'
    let bestResult: OCRResult = tesseract || { text: "", confidence: 0, language: this.language }

    if (paddleOCR) {
      const tesseractScore = tesseract ? this.calculateOCRScore(tesseract) : 0
      const paddleOCRScore = this.calculateOCRScore(paddleOCR)

      if (paddleOCRScore > tesseractScore) {
        bestResult = paddleOCR
        selectedEngine = 'paddleocr'
      } else if (tesseract) {
        bestResult = tesseract
        selectedEngine = 'tesseract'
      }
    }

    return {
      ...bestResult,
      tesseractResult: tesseract || undefined,
      paddleOCRResult: paddleOCR || undefined,
      selectedEngine,
      engine: 'hybrid'
    }
  }

  /**
   * Check if PaddleOCR is available
   */
  isPaddleOCRAvailable(): boolean {
    return this.paddleOCRAvailable
  }

  /**
   * Check if Tesseract is available
   */
  isTesseractAvailable(): boolean {
    return this.tesseractInitialized
  }

  async cleanup() {
    // Cleanup Tesseract
    if (this.tesseract && this.tesseractInitialized) {
      try {
        await this.tesseract.terminate()
        this.tesseractInitialized = false
        this.tesseract = null
        console.log("Tesseract OCR worker terminated successfully")
      } catch (error) {
        console.error("Error terminating Tesseract worker:", error)
      }
    }

    // Cleanup PaddleOCR (if it has cleanup method)
    if (this.paddleOCR && this.paddleOCRInitialized) {
      try {
        if (typeof this.paddleOCR.cleanup === 'function') {
          await this.paddleOCR.cleanup()
        } else if (typeof this.paddleOCR.destroy === 'function') {
          await this.paddleOCR.destroy()
        }
        this.paddleOCRInitialized = false
        this.paddleOCR = null
        console.log("PaddleOCR terminated successfully")
      } catch (error) {
        console.error("Error terminating PaddleOCR:", error)
      }
    }
  }
}
