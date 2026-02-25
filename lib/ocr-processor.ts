// Browser-compatible OCR processor using Tesseract.js

export interface OCRResult {
  text: string
  confidence: number
  language?: string
  engine?: 'tesseract' | 'paddleocr' | 'hybrid'
}

// DualOCRResult kept for API compatibility — always uses Tesseract under the hood
export interface DualOCRResult extends OCRResult {
  tesseractResult?: OCRResult
  paddleOCRResult?: OCRResult
  selectedEngine: 'tesseract' | 'paddleocr' | 'hybrid'
}

export class BrowserOCRProcessor {
  private worker: unknown = null
  private initialized = false
  private language: string

  constructor(language = 'eng', useDualOCR = true) {
    this.language = language
    if (!useDualOCR) {
      console.log('OCR fallback mode enabled (single engine)')
    }
  }

  setLanguage(language: string) {
    if (language && language !== this.language) {
      this.language = language
      this.initialized = false
      this.worker = null
    }
  }

  private async getWorker() {
    if (this.initialized && this.worker) return this.worker

    try {
      // Dynamic import avoids SSR issues — Tesseract.js is browser-only
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker(this.language, 1, {
        logger: (m: unknown) => {
          if (m.status === 'recognizing text') {
            console.log(`OCR progress: ${Math.round(m.progress * 100)}%`)
          }
        },
      })
      this.worker = worker
      this.initialized = true
      console.log('Tesseract worker ready')
      return worker
    } catch (err) {
      console.error('Tesseract init failed:', err)
      throw new Error('OCR unavailable: tesseract.js failed to load.')
    }
  }

  private async recognise(input: HTMLCanvasElement | ImageData | Blob): Promise<OCRResult> {
    try {
      const worker = await this.getWorker()

      // Tesseract.js accepts canvas, ImageData, Blob, or URL directly
      const { data } = await worker.recognize(input)

      return {
        text: data.text?.trim() || '',
        confidence: data.confidence ?? 0,
        language: this.language,
        engine: 'tesseract',
      }
    } catch (err) {
      console.warn('OCR recognition failed:', err)
      return { text: '', confidence: 0, language: this.language, engine: 'tesseract' }
    }
  }

  async processImage(imageData: HTMLCanvasElement | ImageData | Blob): Promise<OCRResult> {
    return this.recognise(imageData)
  }

  async processCanvas(canvas: HTMLCanvasElement): Promise<OCRResult> {
    return this.recognise(canvas)
  }

  async processFile(file: File): Promise<OCRResult> {
    try {
      return await this.recognise(file)
    } catch (err) {
      console.error('OCR file processing failed:', err)
      return { text: '', confidence: 0, language: 'unknown', engine: 'tesseract' }
    }
  }

  // Kept for API compatibility — behaves identically to processImage
  async processImageDual(imageData: HTMLCanvasElement | ImageData | Blob): Promise<DualOCRResult> {
    const result = await this.recognise(imageData)
    return { ...result, tesseractResult: result, selectedEngine: 'tesseract' }
  }

  isPaddleOCRAvailable(): boolean { return false }
  isTesseractAvailable(): boolean { return this.initialized }

  async cleanup() {
    if (this.worker && this.initialized) {
      try {
        await this.worker.terminate()
      } catch {
        // ignore
      } finally {
        this.worker = null
        this.initialized = false
      }
    }
  }
}
