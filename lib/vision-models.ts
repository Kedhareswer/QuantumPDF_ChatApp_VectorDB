'use client';

import type { ImageAnalysisResult, DetectedObject, OCRText } from "@/types/multimodal-types"

export interface VisionModelConfig {
  provider: 'openai' | 'anthropic' | 'huggingface' | 'transformers-js'
  apiKey?: string
  model?: string
  endpoint?: string
}

export interface VisionAnalysisOptions {
  includeObjects?: boolean
  includeOCR?: boolean
  includeTags?: boolean
  maxTokens?: number
  temperature?: number
}

/**
 * Unified Vision Model Service
 * Integrates multiple vision AI providers for image analysis
 */
export class VisionModelService {
  private config: VisionModelConfig
  private apiKey: string | null = null

  constructor(config: VisionModelConfig) {
    this.config = config
    this.apiKey = config.apiKey || null
  }

  /**
   * Analyze an image using the configured vision model
   */
  async analyzeImage(
    imageDataUrl: string,
    prompt?: string,
    options: VisionAnalysisOptions = {},
  ): Promise<ImageAnalysisResult> {
    switch (this.config.provider) {
      case 'openai':
        return await this.analyzeWithOpenAI(imageDataUrl, prompt, options)
      case 'anthropic':
        return await this.analyzeWithAnthropic(imageDataUrl, prompt, options)
      case 'huggingface':
        return await this.analyzeWithHuggingFace(imageDataUrl, prompt, options)
      case 'transformers-js':
        return await this.analyzeWithTransformersJS(imageDataUrl, prompt, options)
      default:
        throw new Error(`Unsupported vision provider: ${this.config.provider}`)
    }
  }

  /**
   * Classify image type (photo, chart, diagram, screenshot, etc.)
   */
  async classifyImage(imageDataUrl: string): Promise<string> {
    const analysis = await this.analyzeImage(
      imageDataUrl,
      'What type of image is this? Options: photo, chart, diagram, graph, table, screenshot, text document, other. Respond with just one word.',
      { maxTokens: 10 }
    )
    
    return analysis.caption.toLowerCase().trim()
  }

  /**
   * OpenAI GPT-4 Vision implementation
   */
  private async analyzeWithOpenAI(
    imageDataUrl: string,
    prompt?: string,
    options: VisionAnalysisOptions = {},
  ): Promise<ImageAnalysisResult> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key required')
    }

    try {
      // Latest stable OpenAI vision model as of December 2025
      const model = this.config.model || 'gpt-4o'  // GPT-4 Omni (multimodal) - also supports gpt-5.1 with vision
      const defaultPrompt = 'Describe this image in detail. Include any text, charts, diagrams, or notable elements.'

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: prompt || defaultPrompt,
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: imageDataUrl,
                    detail: 'high',
                  },
                },
              ],
            },
          ],
          max_tokens: options.maxTokens ?? 300,
          temperature: options.temperature ?? 0.7,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`)
      }

      const data = await response.json()
      const description = data.choices[0]?.message?.content || ''

      // Extract caption (first sentence) and tags
      const caption = this.extractCaption(description)
      const tags = this.extractTags(description)

      return {
        caption,
        description,
        tags,
        objects: [], // GPT-4V doesn't provide structured object detection
        text: undefined,
        confidence: 0.9,
        model: model,
        processedAt: new Date(),
      }
    } catch (error) {
      console.error('OpenAI vision analysis failed:', error)
      throw error
    }
  }

  /**
   * Anthropic Claude Vision implementation
   */
  private async analyzeWithAnthropic(
    imageDataUrl: string,
    prompt?: string,
    options: VisionAnalysisOptions = {},
  ): Promise<ImageAnalysisResult> {
    if (!this.apiKey) {
      throw new Error('Anthropic API key required')
    }

    try {
      // Latest stable Anthropic vision model as of December 2025
      const model = this.config.model || 'claude-sonnet-4-5-20250514'  // Claude 4.5 Sonnet (latest frontier with vision)
      const defaultPrompt = 'Describe this image in detail. Include any text, charts, diagrams, or notable elements.'

      // Extract base64 data from data URL
      const base64Data = imageDataUrl.split(',')[1]
      const mediaType = imageDataUrl.split(';')[0].split(':')[1]

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: options.maxTokens ?? 300,
          temperature: options.temperature ?? 0.7,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: mediaType,
                    data: base64Data,
                  },
                },
                {
                  type: 'text',
                  text: prompt || defaultPrompt,
                },
              ],
            },
          ],
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`)
      }

      const data = await response.json()
      const description = data.content[0]?.text || ''

      const caption = this.extractCaption(description)
      const tags = this.extractTags(description)

      return {
        caption,
        description,
        tags,
        objects: [],
        text: undefined,
        confidence: 0.9,
        model: model,
        processedAt: new Date(),
      }
    } catch (error) {
      console.error('Anthropic vision analysis failed:', error)
      throw error
    }
  }

  /**
   * Hugging Face Inference API implementation
   */
  private async analyzeWithHuggingFace(
    imageDataUrl: string,
    prompt?: string,
    options: VisionAnalysisOptions = {},
  ): Promise<ImageAnalysisResult> {
    if (!this.apiKey) {
      throw new Error('Hugging Face API key required')
    }

    try {
      // Latest stable Hugging Face vision model as of November 2025
      const model = this.config.model || 'Salesforce/blip2-opt-2.7b'  // BLIP-2 (improved version)

      // Convert data URL to blob
      const response = await fetch(imageDataUrl)
      const blob = await response.blob()

      const hfResponse = await fetch(
        `https://api-inference.huggingface.co/models/${model}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: blob,
        }
      )

      if (!hfResponse.ok) {
        throw new Error(`Hugging Face API error: ${hfResponse.statusText}`)
      }

      const data = await hfResponse.json()
      const caption = Array.isArray(data) ? data[0]?.generated_text || '' : data.generated_text || ''

      return {
        caption,
        description: caption,
        tags: this.extractTags(caption),
        objects: [],
        text: undefined,
        confidence: 0.8,
        model: model,
        processedAt: new Date(),
      }
    } catch (error) {
      console.error('Hugging Face vision analysis failed:', error)
      throw error
    }
  }

  /**
   * Transformers.js (client-side) implementation
   */
  private async analyzeWithTransformersJS(
    imageDataUrl: string,
    prompt?: string,
    options: VisionAnalysisOptions = {},
  ): Promise<ImageAnalysisResult> {
    try {
      // Dynamically import Transformers.js
      const { pipeline } = await import('@xenova/transformers')

      // Initialize image-to-text pipeline
      // Latest stable Transformers.js vision model as of November 2025
      const captioner = await pipeline(
        'image-to-text',
        'Xenova/vit-gpt2-image-captioning'  // Still the most stable for client-side
      )

      // Generate caption
      const result = await captioner(imageDataUrl)
      const caption = Array.isArray(result) ? result[0]?.generated_text || '' : result.generated_text || ''

      return {
        caption,
        description: caption,
        tags: this.extractTags(caption),
        objects: [],
        text: undefined,
        confidence: 0.7,
        model: 'Xenova/vit-gpt2-image-captioning',
        processedAt: new Date(),
      }
    } catch (error) {
      console.error('Transformers.js vision analysis failed:', error)
      throw error
    }
  }

  /**
   * Extract a concise caption from a longer description
   */
  private extractCaption(description: string): string {
    // Take first sentence, limit to 100 characters
    const firstSentence = description.split(/[.!?]/)[0].trim()
    return firstSentence.length > 100
      ? firstSentence.substring(0, 97) + '...'
      : firstSentence
  }

  /**
   * Extract tags from description text
   */
  private extractTags(description: string): string[] {
    const tags: Set<string> = new Set()

    // Common keywords to extract as tags
    const keywords = [
      'chart', 'graph', 'diagram', 'table', 'photo', 'screenshot',
      'document', 'text', 'code', 'equation', 'formula',
      'bar chart', 'line chart', 'pie chart', 'scatter plot',
      'flowchart', 'architecture', 'network', 'timeline',
      'map', 'logo', 'icon', 'button', 'interface',
    ]

    const lowerDesc = description.toLowerCase()

    for (const keyword of keywords) {
      if (lowerDesc.includes(keyword)) {
        tags.add(keyword.replace(' ', '-'))
      }
    }

    // Add general tags based on content hints
    if (lowerDesc.match(/\d+(\.\d+)?%|\d+,\d+/)) {
      tags.add('data-visualization')
    }
    if (lowerDesc.includes('x-axis') || lowerDesc.includes('y-axis')) {
      tags.add('chart')
    }
    if (lowerDesc.includes('code') || lowerDesc.includes('syntax')) {
      tags.add('code-snippet')
    }

    return Array.from(tags).slice(0, 10) // Limit to 10 tags
  }

  /**
   * Set or update API key
   */
  setApiKey(key: string): void {
    this.apiKey = key
  }

  /**
   * Check if the service is configured and ready
   */
  isConfigured(): boolean {
    if (this.config.provider === 'transformers-js') {
      return true // Client-side, no API key needed
    }
    return this.apiKey !== null && this.apiKey.length > 0
  }

  /**
   * Get the current provider
   */
  getProvider(): string {
    return this.config.provider
  }

  /**
   * Get the current model
   */
  getModel(): string {
    return this.config.model || 'default'
  }
}

/**
 * Chart Classification Service
 * Specialized service for classifying chart types
 */
export class ChartClassifier {
  private visionService: VisionModelService

  constructor(visionService: VisionModelService) {
    this.visionService = visionService
  }

  /**
   * Classify chart type
   */
  async classifyChart(imageDataUrl: string): Promise<{
    type: string
    confidence: number
    description: string
  }> {
    try {
      const prompt = `What type of chart or graph is this? Options: bar chart, line chart, pie chart, scatter plot, histogram, box plot, heat map, area chart, radar chart, bubble chart, or other. Respond with the chart type and a brief description.`

      const analysis = await this.visionService.analyzeImage(imageDataUrl, prompt, {
        maxTokens: 100,
      })

      const type = this.extractChartType(analysis.caption)
      
      return {
        type,
        confidence: analysis.confidence ?? 0,
        description: analysis.description ?? '',
      }
    } catch (error) {
      console.error('Chart classification failed:', error)
      return {
        type: 'unknown',
        confidence: 0,
        description: 'Failed to classify chart',
      }
    }
  }

  /**
   * Extract chart type from description
   */
  private extractChartType(description: string): string {
    const lower = description.toLowerCase()

    const chartTypes = [
      'bar chart',
      'line chart',
      'pie chart',
      'scatter plot',
      'histogram',
      'box plot',
      'heat map',
      'area chart',
      'radar chart',
      'bubble chart',
    ]

    for (const type of chartTypes) {
      if (lower.includes(type)) {
        return type
      }
    }

    return 'chart'
  }
}

