'use client';

import type { ExtractedEquation } from "@/types/multimodal-types"
import { getMathpixProcessor, type MathpixResult } from "./mathpix-processor"

export interface EquationExtractionOptions {
  maxEquations?: number
  detectInline?: boolean
  detectBlock?: boolean
  preserveFormatting?: boolean
  useMathpix?: boolean // Enable professional OCR when available
  mathpixPageImages?: Map<number, HTMLCanvasElement> // Page canvases for Mathpix
}

export interface EquationExtractionResult {
  equations: ExtractedEquation[]
  totalFound: number
  extractionTime: number
  mathpixUsed?: boolean
}

export interface EquationExtractionProgress {
  stage: string
  pageNumber?: number
  processed: number
  total: number
}

/**
 * Equation Extractor for PDF and text documents
 * Detects and extracts mathematical equations
 * Supports both regex-based detection and Mathpix professional OCR
 */
export class EquationExtractor {
  private extractedEquations: ExtractedEquation[] = []
  private equationCounter = 0
  private mathpixProcessor = getMathpixProcessor()

  // Common LaTeX/math patterns
  private readonly mathPatterns = [
    // LaTeX delimiters
    /\$\$([^$]+)\$\$/g,           // Display math: $$...$$
    /\$([^$]+)\$/g,                // Inline math: $...$
    /\\\[([^\]]+)\\\]/g,           // Display math: \[...\]
    /\\\(([^)]+)\\\)/g,            // Inline math: \(...\)
    
    // Common math symbols and operators
    /[∫∑∏∂√∞≈≠≤≥±×÷∈∉⊂⊃∩∪]/g,
    
    // Fractions and powers
    /\w+\/\w+|\w+\^\w+|\w+_\w+/g,
  ]

  // LaTeX commands that indicate equations
  private readonly latexCommands = [
    'frac', 'sqrt', 'sum', 'int', 'lim', 'prod',
    'alpha', 'beta', 'gamma', 'delta', 'epsilon',
    'partial', 'infty', 'pm', 'times', 'div',
    'leq', 'geq', 'neq', 'approx', 'subset',
  ]

  constructor(private readonly defaultOptions: EquationExtractionOptions = {}) {}

  /**
   * Extract equations from text content
   */
  async extractFromText(
    text: string,
    documentId: string,
    pageNumber?: number,
    options: EquationExtractionOptions = {},
  ): Promise<EquationExtractionResult> {
    const startTime = Date.now()
    this.extractedEquations = []
    this.equationCounter = 0

    const mergedOptions = {
      maxEquations: options.maxEquations ?? this.defaultOptions.maxEquations ?? 50,
      detectInline: options.detectInline ?? this.defaultOptions.detectInline ?? true,
      detectBlock: options.detectBlock ?? this.defaultOptions.detectBlock ?? true,
      preserveFormatting: options.preserveFormatting ?? this.defaultOptions.preserveFormatting ?? true,
    }

    // Split text into lines for better equation detection
    const lines = text.split('\n')

    for (let i = 0; i < lines.length; i++) {
      if (this.extractedEquations.length >= mergedOptions.maxEquations) {
        break
      }

      const line = lines[i]
      
      // Detect LaTeX equations
      const latexEquations = this.detectLatexEquations(
        line,
        i,
        documentId,
        pageNumber,
        mergedOptions,
      )

      // Detect symbolic equations
      const symbolicEquations = this.detectSymbolicEquations(
        line,
        i,
        documentId,
        pageNumber,
        mergedOptions,
      )

      this.extractedEquations.push(...latexEquations, ...symbolicEquations)
    }

    return {
      equations: this.extractedEquations,
      totalFound: this.extractedEquations.length,
      extractionTime: Date.now() - startTime,
    }
  }

  /**
   * Extract equations from PDF pages
   * Uses Mathpix for professional OCR when configured and enabled
   */
  async extractFromPDF(
    pdf: any, // PDFDocumentProxy
    documentId: string,
    options: EquationExtractionOptions = {},
    onProgress?: (progress: EquationExtractionProgress) => void,
  ): Promise<EquationExtractionResult> {
    const startTime = Date.now()
    this.extractedEquations = []
    this.equationCounter = 0

    const mergedOptions = {
      maxEquations: options.maxEquations ?? this.defaultOptions.maxEquations ?? 50,
      detectInline: options.detectInline ?? this.defaultOptions.detectInline ?? true,
      detectBlock: options.detectBlock ?? this.defaultOptions.detectBlock ?? true,
      preserveFormatting: options.preserveFormatting ?? this.defaultOptions.preserveFormatting ?? true,
      useMathpix: options.useMathpix ?? false,
      mathpixPageImages: options.mathpixPageImages,
    }

    const totalPages = pdf.numPages
    let mathpixUsed = false

    // Use Mathpix if configured and enabled
    if (mergedOptions.useMathpix && this.mathpixProcessor.isReady()) {
      console.log('📐 Using Mathpix for professional equation OCR')
      mathpixUsed = true
      
      const mathpixResults = await this.extractWithMathpix(
        pdf,
        documentId,
        mergedOptions,
        onProgress,
      )
      
      this.extractedEquations.push(...mathpixResults)
    }

    // Always do text-based extraction as fallback/supplement
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      if (this.extractedEquations.length >= mergedOptions.maxEquations) {
        break
      }

      try {
        onProgress?.({
          stage: mathpixUsed ? "Supplementing with text analysis" : "Extracting equations",
          pageNumber: pageNum,
          processed: this.extractedEquations.length,
          total: totalPages,
        })

        const page = await pdf.getPage(pageNum)
        const textContent = await page.getTextContent()
        const pageText = textContent.items.map((item: any) => item.str).join(' ')

        const pageEquations = await this.extractFromText(
          pageText,
          documentId,
          pageNum,
          mergedOptions,
        )

        // Add text-based equations that weren't found by Mathpix
        for (const eq of pageEquations.equations) {
          if (!this.isDuplicateEquation(eq)) {
            this.extractedEquations.push(eq)
          }
        }
      } catch (error) {
        console.error(`Error extracting equations from page ${pageNum}:`, error)
      }
    }

    const extractionTime = Date.now() - startTime

    onProgress?.({
      stage: "Completed equation extraction",
      processed: this.extractedEquations.length,
      total: totalPages,
    })

    return {
      equations: this.extractedEquations,
      totalFound: this.extractedEquations.length,
      extractionTime,
      mathpixUsed,
    }
  }

  /**
   * Extract equations using Mathpix professional OCR
   */
  private async extractWithMathpix(
    pdf: any,
    documentId: string,
    options: any,
    onProgress?: (progress: EquationExtractionProgress) => void,
  ): Promise<ExtractedEquation[]> {
    const equations: ExtractedEquation[] = []
    const totalPages = Math.min(pdf.numPages, 10) // Limit to first 10 pages for Mathpix (API costs)

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      if (equations.length >= options.maxEquations) break

      onProgress?.({
        stage: "Mathpix OCR processing",
        pageNumber: pageNum,
        processed: equations.length,
        total: totalPages,
      })

      try {
        // Get page canvas (either from provided map or render it)
        let canvas: HTMLCanvasElement

        if (options.mathpixPageImages?.has(pageNum)) {
          canvas = options.mathpixPageImages.get(pageNum)!
        } else {
          // Render page to canvas
          const page = await pdf.getPage(pageNum)
          const viewport = page.getViewport({ scale: 2.0 }) // High res for better OCR
          
          canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          
          const ctx = canvas.getContext('2d')
          if (!ctx) continue
          
          await page.render({
            canvasContext: ctx,
            viewport,
          }).promise
        }

        // Extract with Mathpix
        const result = await this.mathpixProcessor.extractFromPDFPage(
          canvas,
          pageNum,
          {
            formats: ['latex', 'text', 'mathml'],
            confidenceThreshold: 0.6,
            maxEquations: options.maxEquations - equations.length,
          }
        )

        if (result.success && result.equations.length > 0) {
          for (const mathpixEq of result.equations) {
            equations.push(this.convertMathpixResult(mathpixEq, documentId, pageNum))
          }
        }
      } catch (error) {
        console.error(`Mathpix extraction failed for page ${pageNum}:`, error)
      }
    }

    return equations
  }

  /**
   * Convert Mathpix result to ExtractedEquation format
   */
  private convertMathpixResult(
    result: MathpixResult,
    documentId: string,
    pageNumber: number,
  ): ExtractedEquation {
    return {
      id: `${documentId}_mathpix_${pageNumber}_${++this.equationCounter}`,
      documentId,
      pageNumber,
      latex: result.latex,
      mathml: result.mathml,
      description: result.text || this.latexToPlainText(result.latex),
      isInline: !result.latex?.includes('\\begin{') && !result.latex?.includes('\\['),
      confidence: result.confidence,
      extractedAt: new Date(),
      source: 'mathpix',
    }
  }

  /**
   * Check if equation is a duplicate
   */
  private isDuplicateEquation(eq: ExtractedEquation): boolean {
    const eqContent = eq.latex || eq.description || ''
    return this.extractedEquations.some(existing => {
      const existingContent = existing.latex || existing.description || ''
      return existingContent.trim() === eqContent.trim()
    })
  }

  /**
   * Detect LaTeX-formatted equations
   */
  private detectLatexEquations(
    line: string,
    lineNumber: number,
    documentId: string,
    pageNumber?: number,
    options?: Partial<EquationExtractionOptions>,
  ): ExtractedEquation[] {
    const equations: ExtractedEquation[] = []

    // Try each LaTeX pattern
    for (const pattern of this.mathPatterns.slice(0, 4)) {
      const matches = Array.from(line.matchAll(pattern))

      for (const match of matches) {
        const latex = match[1] || match[0]
        
        // Check if it contains LaTeX commands
        const hasLatexCommands = this.latexCommands.some(cmd => 
          latex.includes(`\\${cmd}`)
        )

        if (hasLatexCommands || this.looksLikeMath(latex)) {
          const isDisplayMode = pattern.source.includes('$$') || pattern.source.includes('\\[')

          equations.push({
            id: `${documentId}_eq_${pageNumber || 0}_${++this.equationCounter}`,
            documentId,
            pageNumber,
            latex,
            mathml: undefined, // Would need converter library
            description: this.latexToPlainText(latex),
            isInline: !isDisplayMode,
            extractedAt: new Date(),
          })
        }
      }
    }

    return equations
  }

  /**
   * Detect symbolic/Unicode math equations
   */
  private detectSymbolicEquations(
    line: string,
    lineNumber: number,
    documentId: string,
    pageNumber?: number,
    options?: Partial<EquationExtractionOptions>,
  ): ExtractedEquation[] {
    const equations: ExtractedEquation[] = []

    // Look for lines with math symbols
    const mathSymbolPattern = this.mathPatterns[4]
    const matches = line.match(mathSymbolPattern)

    if (matches && matches.length >= 2) {
      // Extract the part of the line containing math
      const mathContext = this.extractMathContext(line)

      if (mathContext && mathContext.length > 3) {
        equations.push({
          id: `${documentId}_eq_${pageNumber || 0}_${++this.equationCounter}`,
          documentId,
          pageNumber,
          latex: undefined,
          mathml: undefined,
          description: mathContext,
          isInline: true,
          extractedAt: new Date(),
        })
      }
    }

    return equations
  }

  /**
   * Check if text looks like mathematical content
   */
  private looksLikeMath(text: string): boolean {
    // Check for common math patterns
    const hasFractions = /\w+\/\w+/.test(text)
    const hasPowers = /\w+\^\w+/.test(text)
    const hasSubscripts = /\w+_\w+/.test(text)
    const hasParens = /\([^)]+\)/.test(text)
    const hasEqualsSign = /=/.test(text)
    const hasOperators = /[+\-*/]/.test(text)

    const mathFeatures = [
      hasFractions,
      hasPowers,
      hasSubscripts,
      hasParens && hasOperators,
      hasEqualsSign && hasOperators,
    ].filter(Boolean).length

    return mathFeatures >= 2
  }

  /**
   * Convert LaTeX to plain text description
   */
  private latexToPlainText(latex: string): string {
    let plain = latex

    // Replace common LaTeX commands with readable text
    const replacements: [RegExp, string][] = [
      [/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)'],
      [/\\sqrt\{([^}]+)\}/g, 'sqrt($1)'],
      [/\\sum/g, 'sum'],
      [/\\int/g, 'integral'],
      [/\\lim/g, 'limit'],
      [/\\prod/g, 'product'],
      [/\\infty/g, 'infinity'],
      [/\\partial/g, 'partial'],
      [/\\alpha/g, 'alpha'],
      [/\\beta/g, 'beta'],
      [/\\gamma/g, 'gamma'],
      [/\\delta/g, 'delta'],
      [/\\pm/g, '±'],
      [/\\times/g, '×'],
      [/\\leq/g, '≤'],
      [/\\geq/g, '≥'],
      [/\\neq/g, '≠'],
      [/\\approx/g, '≈'],
    ]

    for (const [pattern, replacement] of replacements) {
      plain = plain.replace(pattern, replacement)
    }

    // Remove remaining backslashes
    plain = plain.replace(/\\/g, '')

    return plain
  }

  /**
   * Extract mathematical context from a line
   */
  private extractMathContext(line: string): string {
    // Find the portion with the most math symbols
    const words = line.split(/\s+/)
    let maxMathScore = 0
    let bestContext = ''

    for (let i = 0; i < words.length; i++) {
      for (let j = i + 1; j <= Math.min(i + 10, words.length); j++) {
        const context = words.slice(i, j).join(' ')
        const mathScore = this.calculateMathScore(context)

        if (mathScore > maxMathScore) {
          maxMathScore = mathScore
          bestContext = context
        }
      }
    }

    return bestContext
  }

  /**
   * Calculate how "mathy" a string is
   */
  private calculateMathScore(text: string): number {
    let score = 0

    // Count math symbols
    const mathSymbols = text.match(/[∫∑∏∂√∞≈≠≤≥±×÷∈∉⊂⊃∩∪]/g)
    if (mathSymbols) score += mathSymbols.length * 2

    // Count operators
    const operators = text.match(/[+\-*/=]/g)
    if (operators) score += operators.length

    // Count numbers
    const numbers = text.match(/\d+/g)
    if (numbers) score += numbers.length * 0.5

    // Count parentheses
    const parens = text.match(/[(){}[\]]/g)
    if (parens) score += parens.length * 0.5

    return score
  }
}

