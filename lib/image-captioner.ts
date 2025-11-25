'use client';

import type { ExtractedImage, ImageAnalysisResult } from "@/types/multimodal-types"
import { VisionModelService, ChartClassifier, type VisionModelConfig } from "./vision-models"

export interface CaptioningOptions {
  provider?: 'huggingface' | 'openai' | 'anthropic' | 'transformers-js' | 'local'
  model?: string
  maxLength?: number
  temperature?: number
  includeOCR?: boolean
  apiKey?: string
  classifyCharts?: boolean
}

export interface CaptioningProgress {
  stage: string
  processed: number
  total: number
}

/**
 * Image Captioning Service
 * Generates captions and descriptions for extracted images using vision models
 */
export class ImageCaptioner {
  private visionService: VisionModelService | null = null
  private chartClassifier: ChartClassifier | null = null

  constructor(private readonly defaultOptions: CaptioningOptions = {}) {
    // Initialize vision service if provider is specified
    if (defaultOptions.provider && defaultOptions.provider !== 'local') {
      this.initializeVisionService(defaultOptions)
    }
  }

  /**
   * Caption a batch of images
   */
  async captionImages(
    images: ExtractedImage[],
    options: CaptioningOptions = {},
    onProgress?: (progress: CaptioningProgress) => void,
  ): Promise<ExtractedImage[]> {
    const mergedOptions: Required<CaptioningOptions> = {
      provider: options.provider ?? this.defaultOptions.provider ?? 'local',
      model: options.model ?? this.defaultOptions.model ?? 'placeholder',
      maxLength: options.maxLength ?? this.defaultOptions.maxLength ?? 100,
      temperature: options.temperature ?? this.defaultOptions.temperature ?? 0.7,
      includeOCR: options.includeOCR ?? this.defaultOptions.includeOCR ?? false,
      apiKey: options.apiKey ?? this.defaultOptions.apiKey ?? '',
      classifyCharts: options.classifyCharts ?? this.defaultOptions.classifyCharts ?? false,
    }

    const captionedImages: ExtractedImage[] = []

    for (let i = 0; i < images.length; i++) {
      onProgress?.({
        stage: 'Generating captions',
        processed: i,
        total: images.length,
      })

      const analysis = await this.analyzeImage(images[i], mergedOptions)
      captionedImages.push({
        ...images[i],
        caption: analysis.caption || images[i].caption,
        altText: analysis.description || images[i].altText,
        analysis,
      })
    }

    onProgress?.({
      stage: 'Captioning complete',
      processed: images.length,
      total: images.length,
    })

    return captionedImages
  }

  /**
   * Initialize vision service with options
   */
  private initializeVisionService(options: CaptioningOptions): void {
    if (options.provider === 'local') {
      this.visionService = null
      return
    }

    const config: VisionModelConfig = {
      provider: options.provider as any,
      apiKey: options.apiKey,
      model: options.model,
    }

    this.visionService = new VisionModelService(config)
    
    if (options.classifyCharts) {
      this.chartClassifier = new ChartClassifier(this.visionService)
    }
  }

  /**
   * Analyze a single image using vision models or fallback to placeholder
   */
  private async analyzeImage(
    image: ExtractedImage,
    options: Required<CaptioningOptions>,
  ): Promise<ImageAnalysisResult> {
    // Use vision model if available and configured
    if (this.visionService && this.visionService.isConfigured()) {
      try {
        // Classify charts if enabled
        if (options.classifyCharts && this.chartClassifier && 
            (image.type === 'chart' || image.type === 'inline-image')) {
          const chartClassification = await this.chartClassifier.classifyChart(image.dataUrl)
          
          if (chartClassification.type !== 'unknown') {
            // It's a chart - get detailed analysis
            const analysis = await this.visionService.analyzeImage(
              image.dataUrl,
              'Describe this chart in detail. Include the chart type, data trends, key insights, and any notable patterns.',
              {
                maxTokens: 300,
                temperature: options.temperature,
              }
            )

            return {
              ...analysis,
              caption: `${chartClassification.type}: ${analysis.caption}`,
              tags: [...analysis.tags, chartClassification.type.replace(' ', '-')],
            }
          }
        }

        // Regular image analysis
        const prompt = this.buildAnalysisPrompt(image)
        const analysis = await this.visionService.analyzeImage(
          image.dataUrl,
          prompt,
          {
            maxTokens: 300,
            temperature: options.temperature,
            includeOCR: options.includeOCR,
          }
        )

        return analysis
      } catch (error) {
        console.error('Vision model analysis failed, using placeholder:', error)
        // Fall through to placeholder
      }
    }

    // Fallback to placeholder analysis
    return {
      caption: this.generatePlaceholderCaption(image),
      description: this.generatePlaceholderDescription(image),
      tags: this.generatePlaceholderTags(image),
      objects: [],
      text: options.includeOCR ? [] : undefined,
      confidence: 0.5, // Low confidence for placeholder
      model: options.model || 'placeholder',
      processedAt: new Date(),
    }
  }

  /**
   * Build analysis prompt based on image type
   */
  private buildAnalysisPrompt(image: ExtractedImage): string {
    switch (image.type) {
      case 'page-preview':
        return 'This is a page preview from a document. Describe the overall layout, any headings, key content areas, and notable visual elements.'
      case 'chart':
        return 'Analyze this chart or graph. Describe the chart type, what data it shows, trends, and key insights.'
      case 'figure':
        return 'This is a figure from a document. Describe what it depicts, its purpose, and any important details.'
      case 'inline-image':
        return 'Describe this image in detail. Include any text, diagrams, charts, or notable elements that would be useful in a document context.'
      default:
        return 'Describe this image in detail.'
    }
  }

  /**
   * Generate a placeholder caption based on image type and metadata
   */
  private generatePlaceholderCaption(image: ExtractedImage): string {
    switch (image.type) {
      case 'page-preview':
        return `Page ${image.pageNumber || 'unknown'} from document`
      case 'chart':
        return 'Chart or diagram from document'
      case 'diagram':
        return 'Technical diagram or illustration'
      case 'figure':
        return 'Figure from document'
      case 'inline-image':
        if (image.source === 'pdf') {
          return `Image from page ${image.pageNumber || 'unknown'}`
        } else if (image.source === 'docx') {
          return 'Embedded image from Word document'
        }
        return 'Inline image from document'
      default:
        return 'Image from document'
    }
  }

  /**
   * Generate a placeholder description
   */
  private generatePlaceholderDescription(image: ExtractedImage): string {
    const dimensions = `${image.width}x${image.height}px`
    const source = (image.source ?? 'unknown').toUpperCase()
    const type = (image.type ?? 'generic').replace('-', ' ')

    return `A ${type} image extracted from a ${source} document. Image dimensions: ${dimensions}. Full analysis requires vision model integration.`
  }

  /**
   * Generate placeholder tags
   */
  private generatePlaceholderTags(image: ExtractedImage): string[] {
    const tags: string[] = [image.type ?? 'image', image.source ?? 'unknown']

    if (image.pageNumber) {
      tags.push(`page-${image.pageNumber}`)
    }

    if (image.width > 800 || image.height > 800) {
      tags.push('high-resolution')
    }

    if (image.type === 'chart' || image.type === 'diagram') {
      tags.push('visual-data')
    }

    return tags
  }

  /**
   * Set API key for remote captioning services
   */
  setApiKey(key: string, provider?: string): void {
    if (this.visionService) {
      this.visionService.setApiKey(key)
    } else if (provider && provider !== 'local') {
      // Initialize vision service with the new API key
      this.initializeVisionService({
        ...this.defaultOptions,
        provider: provider as any,
        apiKey: key,
      })
    }
  }

  /**
   * Check if captioning is available with the current configuration
   */
  isAvailable(): boolean {
    // Local placeholder always available
    if (!this.visionService) {
      return true
    }
    // Check if vision service is configured
    return this.visionService.isConfigured()
  }

  /**
   * Get supported captioning providers
   */
  getSupportedProviders(): string[] {
    return ['local', 'transformers-js', 'huggingface', 'openai', 'anthropic']
  }

  /**
   * Get current provider name
   */
  getCurrentProvider(): string {
    return this.visionService?.getProvider() || 'local'
  }

  /**
   * Get current model name
   */
  getCurrentModel(): string {
    return this.visionService?.getModel() || 'placeholder'
  }
}

/**
 * Utility: Extract text from images using OCR (Tesseract.js)
 * Can be used as part of image analysis
 */
export async function extractTextFromImage(
  dataUrl: string,
  onProgress?: (progress: { status: string; progress: number }) => void,
): Promise<string> {
  try {
    // Dynamically import Tesseract.js only when needed
    const Tesseract = (await import('tesseract.js')).default

    const result = await Tesseract.recognize(dataUrl, 'eng', {
      logger: (m) => {
        if (onProgress && m.status) {
          onProgress({ status: m.status, progress: m.progress || 0 })
        }
      },
    })

    return result.data.text
  } catch (error) {
    console.error('OCR extraction failed:', error)
    return ''
  }
}

