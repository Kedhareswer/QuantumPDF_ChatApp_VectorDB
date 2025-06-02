// Simplified OCR Processor without Tesseract.js dependency

export interface OCRResult {
  text: string
  confidence: number
  blocks: Array<{
    text: string
    confidence: number
    bbox: { x: number; y: number; width: number; height: number }
  }>
}

export interface OCRProgress {
  stage: string
  progress: number
  details?: string
}

export class OCRProcessor {
  private isInitialized = false

  constructor() {
    this.isInitialized = true // Always available as fallback
  }

  async processImageToText(
    imageData: ImageData | HTMLCanvasElement | string,
    onProgress?: (progress: OCRProgress) => void,
  ): Promise<OCRResult> {
    onProgress?.({
      stage: "OCR processing not available...",
      progress: 100,
    })

    return {
      text: "[OCR processing is not available in this environment. Please use text-based PDFs or manual text entry.]",
      confidence: 0,
      blocks: [],
    }
  }

  async processCanvasToText(
    canvas: HTMLCanvasElement,
    onProgress?: (progress: OCRProgress) => void,
  ): Promise<OCRResult> {
    return this.processImageToText(canvas, onProgress)
  }

  async processImageUrlToText(imageUrl: string, onProgress?: (progress: OCRProgress) => void): Promise<OCRResult> {
    return this.processImageToText(imageUrl, onProgress)
  }

  async processWithPreprocessing(
    imageData: ImageData | HTMLCanvasElement,
    onProgress?: (progress: OCRProgress) => void,
  ): Promise<OCRResult> {
    return this.processImageToText(imageData, onProgress)
  }

  isAvailable(): boolean {
    return false // OCR not available to prevent usage
  }

  async fallbackOCR(canvas: HTMLCanvasElement): Promise<OCRResult> {
    return {
      text: "[OCR functionality disabled. Please use text-based PDFs or manual text entry.]",
      confidence: 0,
      blocks: [],
    }
  }
}
