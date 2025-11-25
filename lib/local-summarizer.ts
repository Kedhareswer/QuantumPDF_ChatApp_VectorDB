'use client';

/**
 * Local Summarizer Service
 * Uses Transformers.js for client-side text summarization and explanations
 * Runs entirely in the browser - no API calls required
 */

export interface SummaryOptions {
  maxLength?: number
  minLength?: number
  style?: 'brief' | 'detailed' | 'bullet-points'
  temperature?: number
}

export interface ExplanationOptions {
  complexity?: 'simple' | 'moderate' | 'technical'
  targetAudience?: string
  maxLength?: number
}

export interface LocalSummarizerResult {
  text: string
  confidence: number
  model: string
  processingTime: number
  tokens?: number
}

// Cache for the loaded pipeline to avoid re-loading
let summarizationPipeline: any = null
let textGenerationPipeline: any = null
let pipelineLoadingPromise: Promise<any> | null = null
let generationLoadingPromise: Promise<any> | null = null

/**
 * Local Summarizer using Transformers.js
 */
export class LocalSummarizer {
  private modelName: string
  private isLoading = false
  private loadError: Error | null = null

  constructor(modelName: string = 'Xenova/distilbart-cnn-6-6') {
    this.modelName = modelName
  }

  /**
   * Load the summarization model (lazy loaded on first use)
   */
  private async loadPipeline(): Promise<any> {
    if (summarizationPipeline) {
      return summarizationPipeline
    }

    if (pipelineLoadingPromise) {
      return pipelineLoadingPromise
    }

    this.isLoading = true
    this.loadError = null

    pipelineLoadingPromise = (async () => {
      try {
        console.log(`LocalSummarizer: Loading model ${this.modelName}...`)
        const { pipeline } = await import('@xenova/transformers')
        const typedPipeline = pipeline as any
        
        summarizationPipeline = await typedPipeline('summarization', this.modelName, {
          quantized: true, // Use quantized model for faster loading
        })
        
        console.log('LocalSummarizer: Model loaded successfully')
        return summarizationPipeline
      } catch (error) {
        console.error('LocalSummarizer: Failed to load model:', error)
        this.loadError = error instanceof Error ? error : new Error('Unknown error loading model')
        throw this.loadError
      } finally {
        this.isLoading = false
      }
    })()

    return pipelineLoadingPromise
  }

  /**
   * Load the text generation model for explanations
   */
  private async loadGenerationPipeline(): Promise<any> {
    if (textGenerationPipeline) {
      return textGenerationPipeline
    }

    if (generationLoadingPromise) {
      return generationLoadingPromise
    }

    generationLoadingPromise = (async () => {
      try {
        console.log('LocalSummarizer: Loading text generation model...')
        const { pipeline } = await import('@xenova/transformers')
        const typedPipeline = pipeline as any
        
        // Use a small, fast text generation model
        textGenerationPipeline = await typedPipeline('text-generation', 'Xenova/distilgpt2', {
          quantized: true,
        })
        
        console.log('LocalSummarizer: Text generation model loaded')
        return textGenerationPipeline
      } catch (error) {
        console.error('LocalSummarizer: Failed to load text generation model:', error)
        throw error
      }
    })()

    return generationLoadingPromise
  }

  /**
   * Generate a summary of the provided text
   */
  async summarize(
    text: string,
    options: SummaryOptions = {}
  ): Promise<LocalSummarizerResult> {
    const startTime = Date.now()

    try {
      // Validate input
      if (!text || text.trim().length < 50) {
        return {
          text: text.trim(),
          confidence: 1.0,
          model: 'passthrough',
          processingTime: Date.now() - startTime,
        }
      }

      // Load pipeline
      const pipe = await this.loadPipeline()

      // Configure generation parameters
      const maxLength = options.maxLength ?? 150
      const minLength = options.minLength ?? 30

      // Truncate very long inputs (models have token limits)
      const truncatedText = text.length > 4000 ? text.substring(0, 4000) + '...' : text

      // Generate summary
      const result = await pipe(truncatedText, {
        max_length: maxLength,
        min_length: minLength,
        do_sample: false, // Deterministic output
      })

      const summaryText = Array.isArray(result) 
        ? result[0]?.summary_text || ''
        : result.summary_text || ''

      // Post-process based on style
      let finalText = summaryText
      if (options.style === 'bullet-points') {
        finalText = this.convertToBulletPoints(summaryText)
      }

      return {
        text: finalText.trim(),
        confidence: 0.85,
        model: this.modelName,
        processingTime: Date.now() - startTime,
      }
    } catch (error) {
      console.error('LocalSummarizer: Summarization failed:', error)
      
      // Fallback to extractive summary
      return {
        text: this.extractiveSummary(text, options.maxLength ?? 150),
        confidence: 0.5,
        model: 'extractive-fallback',
        processingTime: Date.now() - startTime,
      }
    }
  }

  /**
   * Generate a TL;DR for text content
   */
  async tldr(text: string): Promise<LocalSummarizerResult> {
    return this.summarize(text, {
      maxLength: 75,
      minLength: 20,
      style: 'brief',
    })
  }

  /**
   * Generate an explanation of a concept or topic
   */
  async explain(
    topic: string,
    context?: string,
    options: ExplanationOptions = {}
  ): Promise<LocalSummarizerResult> {
    const startTime = Date.now()

    try {
      // For explanations, we use a prompt-based approach
      const complexity = options.complexity ?? 'moderate'
      const prompt = this.buildExplanationPrompt(topic, context, complexity)

      // Try to use text generation model
      try {
        const pipe = await this.loadGenerationPipeline()
        
        const result = await pipe(prompt, {
          max_new_tokens: options.maxLength ?? 150,
          temperature: 0.7,
          do_sample: true,
        })

        const generatedText = Array.isArray(result)
          ? result[0]?.generated_text || ''
          : result.generated_text || ''

        // Extract only the new generated content (after the prompt)
        const explanation = generatedText.substring(prompt.length).trim()

        return {
          text: explanation || this.fallbackExplanation(topic, context),
          confidence: 0.7,
          model: 'Xenova/distilgpt2',
          processingTime: Date.now() - startTime,
        }
      } catch {
        // Fall back to template-based explanation
        return {
          text: this.fallbackExplanation(topic, context),
          confidence: 0.5,
          model: 'template-fallback',
          processingTime: Date.now() - startTime,
        }
      }
    } catch (error) {
      console.error('LocalSummarizer: Explanation generation failed:', error)
      return {
        text: this.fallbackExplanation(topic, context),
        confidence: 0.3,
        model: 'error-fallback',
        processingTime: Date.now() - startTime,
      }
    }
  }

  /**
   * Convert paragraph text to bullet points
   */
  private convertToBulletPoints(text: string): string {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10)
    return sentences.map(s => `• ${s.trim()}`).join('\n')
  }

  /**
   * Simple extractive summary as fallback
   */
  private extractiveSummary(text: string, maxLength: number): string {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10)
    
    if (sentences.length === 0) {
      return text.substring(0, maxLength)
    }

    // Score sentences by position and keywords
    const scored = sentences.map((sentence, index) => {
      let score = 0
      
      // Position bonus (first and last sentences often important)
      if (index === 0) score += 3
      if (index === sentences.length - 1) score += 2
      
      // Keyword bonus
      const keywords = /\b(important|key|main|conclusion|result|finding|summary|therefore|thus|hence|overall|significant)\b/i
      if (keywords.test(sentence)) score += 2
      
      // Length penalty for very short/long sentences
      const wordCount = sentence.split(/\s+/).length
      if (wordCount < 5) score -= 1
      if (wordCount > 30) score -= 1
      
      return { sentence: sentence.trim(), score }
    })

    // Sort by score and take top sentences
    scored.sort((a, b) => b.score - a.score)
    
    let summary = ''
    for (const { sentence } of scored) {
      if (summary.length + sentence.length > maxLength) break
      summary += sentence + '. '
    }

    return summary.trim() || sentences[0].trim() + '.'
  }

  /**
   * Build a prompt for explanation generation
   */
  private buildExplanationPrompt(topic: string, context?: string, complexity: string = 'moderate'): string {
    const complexityInstructions = {
      'simple': 'in simple terms that anyone can understand',
      'moderate': 'clearly and concisely',
      'technical': 'with technical detail and precision',
    }

    const instruction = complexityInstructions[complexity as keyof typeof complexityInstructions] || complexityInstructions.moderate

    if (context) {
      return `Based on the following context: "${context.substring(0, 500)}"

Explain ${instruction} what "${topic}" means: `
    }

    return `Explain ${instruction} what "${topic}" means: `
  }

  /**
   * Fallback explanation using templates
   */
  private fallbackExplanation(topic: string, context?: string): string {
    if (context) {
      // Extract relevant sentences from context
      const sentences = context.split(/[.!?]+/).filter(s => 
        s.toLowerCase().includes(topic.toLowerCase().split(' ')[0])
      )
      
      if (sentences.length > 0) {
        return `Based on the document: ${sentences[0].trim()}.`
      }
    }

    return `"${topic}" is a concept mentioned in the document. For more details, please refer to the relevant sections of the source material.`
  }

  /**
   * Check if the summarizer is ready to use
   */
  isReady(): boolean {
    return summarizationPipeline !== null
  }

  /**
   * Check if currently loading
   */
  isModelLoading(): boolean {
    return this.isLoading
  }

  /**
   * Get any load error
   */
  getLoadError(): Error | null {
    return this.loadError
  }

  /**
   * Get model name
   */
  getModelName(): string {
    return this.modelName
  }

  /**
   * Preload the model for faster first use
   */
  async preload(): Promise<boolean> {
    try {
      await this.loadPipeline()
      return true
    } catch {
      return false
    }
  }
}

// Singleton instance for easy access
let globalSummarizer: LocalSummarizer | null = null

export function getLocalSummarizer(): LocalSummarizer {
  if (!globalSummarizer) {
    globalSummarizer = new LocalSummarizer()
  }
  return globalSummarizer
}

/**
 * Quick helper function for one-off summaries
 */
export async function quickSummarize(text: string, options?: SummaryOptions): Promise<string> {
  const summarizer = getLocalSummarizer()
  const result = await summarizer.summarize(text, options)
  return result.text
}

/**
 * Quick helper function for TL;DR
 */
export async function quickTldr(text: string): Promise<string> {
  const summarizer = getLocalSummarizer()
  const result = await summarizer.tldr(text)
  return result.text
}

