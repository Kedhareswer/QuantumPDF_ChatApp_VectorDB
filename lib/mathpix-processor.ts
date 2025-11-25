'use client';

/**
 * Mathpix Processor - Professional equation OCR
 * Uses Mathpix API to extract equations from images with high accuracy
 * Supports LaTeX, MathML, and plain text output
 */

export interface MathpixConfig {
  appId: string
  appKey: string
  endpoint?: string
}

export interface MathpixResult {
  latex: string
  latex_styled?: string
  mathml?: string
  asciimath?: string
  text?: string
  confidence: number
  position?: {
    top_left_x: number
    top_left_y: number
    width: number
    height: number
  }
}

export interface MathpixExtractionResult {
  equations: MathpixResult[]
  rawText?: string
  processingTime: number
  success: boolean
  error?: string
}

export interface MathpixOptions {
  formats?: ('latex' | 'mathml' | 'asciimath' | 'text')[]
  includeDetectedPositions?: boolean
  confidenceThreshold?: number
  maxEquations?: number
}

const DEFAULT_MATHPIX_ENDPOINT = 'https://api.mathpix.com/v3'

/**
 * Mathpix Processor Service
 * Provides professional-grade equation OCR using Mathpix API
 */
export class MathpixProcessor {
  private config: MathpixConfig | null = null
  private isConfigured = false

  constructor(config?: MathpixConfig) {
    if (config) {
      this.configure(config)
    }
  }

  /**
   * Configure the Mathpix processor with API credentials
   */
  configure(config: MathpixConfig): void {
    if (!config.appId || !config.appKey) {
      throw new Error('Mathpix requires both appId and appKey')
    }
    
    this.config = {
      ...config,
      endpoint: config.endpoint || DEFAULT_MATHPIX_ENDPOINT,
    }
    this.isConfigured = true
    console.log('✅ Mathpix processor configured')
  }

  /**
   * Check if Mathpix is configured and ready
   */
  isReady(): boolean {
    return this.isConfigured && this.config !== null
  }

  /**
   * Get configuration status
   */
  getStatus(): { configured: boolean; endpoint: string | null } {
    return {
      configured: this.isConfigured,
      endpoint: this.config?.endpoint || null,
    }
  }

  /**
   * Extract equations from an image (base64 data URL or file)
   */
  async extractFromImage(
    imageSource: string | File | Blob,
    options: MathpixOptions = {}
  ): Promise<MathpixExtractionResult> {
    const startTime = Date.now()

    if (!this.isReady()) {
      return {
        equations: [],
        processingTime: Date.now() - startTime,
        success: false,
        error: 'Mathpix not configured. Please set API credentials.',
      }
    }

    try {
      // Convert source to base64 if needed
      let base64Image: string
      
      if (typeof imageSource === 'string') {
        // Already a data URL or base64
        base64Image = imageSource.includes('base64,') 
          ? imageSource.split('base64,')[1] 
          : imageSource
      } else {
        // File or Blob
        base64Image = await this.fileToBase64(imageSource)
      }

      // Make API request
      const response = await this.callMathpixAPI(base64Image, options)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`Mathpix API error: ${response.status} - ${errorData.error || response.statusText}`)
      }

      const data = await response.json()
      
      // Parse and extract equations from response
      const equations = this.parseResponse(data, options)

      return {
        equations,
        rawText: data.text,
        processingTime: Date.now() - startTime,
        success: true,
      }
    } catch (error) {
      console.error('Mathpix extraction error:', error)
      return {
        equations: [],
        processingTime: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Extract equations from a PDF page image
   */
  async extractFromPDFPage(
    pageCanvas: HTMLCanvasElement,
    pageNumber: number,
    options: MathpixOptions = {}
  ): Promise<MathpixExtractionResult> {
    try {
      // Convert canvas to data URL
      const dataUrl = pageCanvas.toDataURL('image/png', 0.95)
      const result = await this.extractFromImage(dataUrl, options)
      
      // Add page number to equation metadata
      result.equations = result.equations.map(eq => ({
        ...eq,
        position: eq.position ? {
          ...eq.position,
          pageNumber,
        } as any : undefined,
      }))
      
      return result
    } catch (error) {
      console.error(`Mathpix extraction failed for page ${pageNumber}:`, error)
      return {
        equations: [],
        processingTime: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Batch extract from multiple images
   */
  async extractBatch(
    images: (string | File | Blob)[],
    options: MathpixOptions = {},
    onProgress?: (current: number, total: number) => void
  ): Promise<MathpixExtractionResult[]> {
    const results: MathpixExtractionResult[] = []
    
    for (let i = 0; i < images.length; i++) {
      onProgress?.(i + 1, images.length)
      const result = await this.extractFromImage(images[i], options)
      results.push(result)
      
      // Rate limiting - Mathpix has API limits
      if (i < images.length - 1) {
        await this.delay(200) // 200ms delay between requests
      }
    }
    
    return results
  }

  /**
   * Call Mathpix API
   */
  private async callMathpixAPI(
    base64Image: string,
    options: MathpixOptions
  ): Promise<Response> {
    const formats = options.formats || ['latex', 'text']
    
    const requestBody: any = {
      src: `data:image/png;base64,${base64Image}`,
      formats: formats,
      include_detected_alphabets: true,
      include_line_data: true,
    }

    if (options.includeDetectedPositions) {
      requestBody.include_word_data = true
    }

    // Use /text endpoint for general math OCR
    const response = await fetch(`${this.config!.endpoint}/text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'app_id': this.config!.appId,
        'app_key': this.config!.appKey,
      },
      body: JSON.stringify(requestBody),
    })

    return response
  }

  /**
   * Parse Mathpix API response
   */
  private parseResponse(
    data: any,
    options: MathpixOptions
  ): MathpixResult[] {
    const equations: MathpixResult[] = []
    const threshold = options.confidenceThreshold ?? 0.5
    const maxEquations = options.maxEquations ?? 50

    // Check for confidence
    const confidence = data.confidence ?? data.confidence_rate ?? 0.8

    if (confidence < threshold) {
      console.log(`Mathpix result below confidence threshold: ${confidence}`)
      return equations
    }

    // Main equation from response
    if (data.latex || data.text) {
      equations.push({
        latex: data.latex || this.textToLatex(data.text),
        latex_styled: data.latex_styled,
        mathml: data.mathml,
        asciimath: data.asciimath,
        text: data.text,
        confidence,
      })
    }

    // Parse line-by-line data if available
    if (data.line_data && Array.isArray(data.line_data)) {
      for (const line of data.line_data) {
        if (equations.length >= maxEquations) break
        
        // Check if line contains math
        if (line.type === 'math' || this.containsMath(line.text)) {
          const lineConfidence = line.confidence ?? confidence

          if (lineConfidence >= threshold) {
            equations.push({
              latex: line.latex || this.textToLatex(line.text),
              text: line.text,
              confidence: lineConfidence,
              position: line.cnt ? {
                top_left_x: line.cnt[0]?.[0] ?? 0,
                top_left_y: line.cnt[0]?.[1] ?? 0,
                width: (line.cnt[1]?.[0] ?? 0) - (line.cnt[0]?.[0] ?? 0),
                height: (line.cnt[2]?.[1] ?? 0) - (line.cnt[0]?.[1] ?? 0),
              } : undefined,
            })
          }
        }
      }
    }

    // Deduplicate
    return this.deduplicateEquations(equations)
  }

  /**
   * Check if text contains mathematical content
   */
  private containsMath(text: string): boolean {
    if (!text) return false
    
    // Math indicators
    const mathPatterns = [
      /[=+\-*/^_{}\\]/,                    // Operators and LaTeX chars
      /\d+\s*[+\-*/=]\s*\d+/,              // Simple expressions
      /[∫∑∏∂√∞≈≠≤≥±×÷∈∉⊂⊃]/,             // Math symbols
      /\\[a-z]+/i,                          // LaTeX commands
      /\([^)]+\)/,                          // Parenthetical expressions
      /\b(sin|cos|tan|log|ln|lim|sum|int)\b/i, // Function names
      /[α-ωΑ-Ω]/,                          // Greek letters
    ]

    return mathPatterns.some(pattern => pattern.test(text))
  }

  /**
   * Convert plain text to basic LaTeX
   */
  private textToLatex(text: string): string {
    if (!text) return ''
    
    let latex = text

    // Basic conversions
    const replacements: [RegExp, string][] = [
      [/\*/g, '\\times '],
      [/\//g, '\\div '],
      [/sqrt\(([^)]+)\)/gi, '\\sqrt{$1}'],
      [/\^(\d+)/g, '^{$1}'],
      [/(\w)_(\w)/g, '$1_{$2}'],
      [/infinity/gi, '\\infty'],
      [/>=|≥/g, '\\geq '],
      [/<=|≤/g, '\\leq '],
      [/!=/g, '\\neq '],
      [/pi/gi, '\\pi'],
      [/theta/gi, '\\theta'],
      [/alpha/gi, '\\alpha'],
      [/beta/gi, '\\beta'],
      [/gamma/gi, '\\gamma'],
      [/delta/gi, '\\delta'],
      [/sigma/gi, '\\sigma'],
    ]

    for (const [pattern, replacement] of replacements) {
      latex = latex.replace(pattern, replacement)
    }

    return latex
  }

  /**
   * Deduplicate equations by content
   */
  private deduplicateEquations(equations: MathpixResult[]): MathpixResult[] {
    const seen = new Set<string>()
    return equations.filter(eq => {
      const key = eq.latex || eq.text || ''
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  /**
   * Convert file to base64
   */
  private async fileToBase64(file: File | Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        resolve(result.split('base64,')[1] || result)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  /**
   * Delay helper for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Evaluate a LaTeX expression (basic evaluation without external deps)
   */
  async evaluateExpression(latex: string): Promise<{
    result: string | number | null
    simplified?: string
    error?: string
  }> {
    try {
      // Convert LaTeX to evaluable expression
      const expr = this.latexToExpression(latex)
      
      // Basic evaluation using JavaScript eval (safe for math expressions)
      // Only evaluate if it looks like a safe math expression
      if (/^[\d\s+\-*/().]+$/.test(expr)) {
        try {
          const result = Function('"use strict"; return (' + expr + ')')()
          return {
            result: typeof result === 'number' ? result : null,
          }
        } catch {
          // Evaluation failed, return the expression
          return {
            result: null,
            error: 'Expression too complex for basic evaluation',
          }
        }
      }

      return {
        result: null,
        error: 'Expression contains non-numeric content',
      }
    } catch (error) {
      return {
        result: null,
        error: error instanceof Error ? error.message : 'Evaluation failed',
      }
    }
  }

  /**
   * Convert LaTeX to math.js compatible expression
   */
  private latexToExpression(latex: string): string {
    let expr = latex

    // Remove display math delimiters
    expr = expr.replace(/^\$+|\$+$/g, '')
    expr = expr.replace(/^\\\[|\\\]$/g, '')

    // LaTeX to expression conversions
    const conversions: [RegExp, string][] = [
      [/\\frac\{([^}]+)\}\{([^}]+)\}/g, '(($1)/($2))'],
      [/\\sqrt\{([^}]+)\}/g, 'sqrt($1)'],
      [/\\sqrt\[(\d+)\]\{([^}]+)\}/g, 'nthRoot($2, $1)'],
      [/\\sin/g, 'sin'],
      [/\\cos/g, 'cos'],
      [/\\tan/g, 'tan'],
      [/\\log/g, 'log10'],
      [/\\ln/g, 'log'],
      [/\\exp/g, 'exp'],
      [/\\pi/g, 'pi'],
      [/\\times/g, '*'],
      [/\\cdot/g, '*'],
      [/\\div/g, '/'],
      [/\\pm/g, '±'],
      [/\^/g, '^'],
      [/\{/g, '('],
      [/\}/g, ')'],
      [/\s+/g, ''],
    ]

    for (const [pattern, replacement] of conversions) {
      expr = expr.replace(pattern, replacement)
    }

    return expr
  }
}

// Singleton instance
let mathpixInstance: MathpixProcessor | null = null

export function getMathpixProcessor(): MathpixProcessor {
  if (!mathpixInstance) {
    mathpixInstance = new MathpixProcessor()
  }
  return mathpixInstance
}

export function configureMathpix(config: MathpixConfig): MathpixProcessor {
  const processor = getMathpixProcessor()
  processor.configure(config)
  return processor
}

