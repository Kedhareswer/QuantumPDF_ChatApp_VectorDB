'use client';

import type { ExtractedImage } from "@/types/multimodal-types";

export interface ImageExtractionOptions {
  maxImages?: number
  minWidth?: number
  minHeight?: number
  quality?: number // 0-1 for compression
  extractMetadata?: boolean
  scale?: number
}

export interface PagePreviewExtractionOptions extends ImageExtractionOptions {
  maxPages?: number
  includeFullPageSnapshot?: boolean
}

export interface ImageExtractionResult {
  images: ExtractedImage[]
  totalFound: number
  extractionTime: number
}

export interface ImageExtractionProgress {
  stage: string
  pageNumber?: number
  processed: number
  total: number
}

/**
 * Image Extractor for PDF documents
 * Currently extracts high-resolution page previews that can be sent to
 * vision models for captioning and chart detection.
 */
export class PDFImageExtractor {
  private extractedImages: ExtractedImage[] = []
  private imageCounter = 0

  constructor(private readonly defaultOptions: PagePreviewExtractionOptions = {}) {}

  /**
   * Extract high-resolution previews for selected pages
   */
  async extractPagePreviews(
    pdf: unknown, // PDFDocumentProxy
    documentId: string,
    options: PagePreviewExtractionOptions = {},
    onProgress?: (progress: ImageExtractionProgress) => void,
  ): Promise<ImageExtractionResult> {
    const startTime = Date.now()
    this.extractedImages = []
    this.imageCounter = 0

    const mergedOptions: Required<PagePreviewExtractionOptions> = {
      maxPages: options.maxPages ?? this.defaultOptions.maxPages ?? 3,
      maxImages: options.maxImages ?? this.defaultOptions.maxImages ?? 3,
      minWidth: options.minWidth ?? this.defaultOptions.minWidth ?? 128,
      minHeight: options.minHeight ?? this.defaultOptions.minHeight ?? 128,
      quality: options.quality ?? this.defaultOptions.quality ?? 0.85,
      extractMetadata: options.extractMetadata ?? this.defaultOptions.extractMetadata ?? true,
      scale: options.scale ?? this.defaultOptions.scale ?? 1.4,
      includeFullPageSnapshot:
        options.includeFullPageSnapshot ?? this.defaultOptions.includeFullPageSnapshot ?? true,
    }

    const totalPages = pdf.numPages
    const pagesToCapture = Math.min(mergedOptions.maxPages, totalPages)

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      if (this.extractedImages.length >= mergedOptions.maxImages || this.extractedImages.length >= pagesToCapture) {
        break
      }

      try {
        onProgress?.({
          stage: "Rendering page preview",
          pageNumber: pageNum,
          processed: this.extractedImages.length,
          total: pagesToCapture,
        })

        const page = await pdf.getPage(pageNum)
        const preview = await this.renderPagePreview(page, pageNum, documentId, mergedOptions)
        if (preview) {
          this.extractedImages.push(preview)
        }
      } catch (error) {
        console.error(`Error generating preview for page ${pageNum}:`, error)
      }
    }

    const extractionTime = Date.now() - startTime

    onProgress?.({
      stage: "Completed page preview extraction",
      processed: this.extractedImages.length,
      total: pagesToCapture,
    })

    return {
      images: this.extractedImages,
      totalFound: this.extractedImages.length,
      extractionTime,
    }
  }

  /**
   * Render a single PDF page into a high-resolution preview image
   */
  private async renderPagePreview(
    page: unknown,
    pageNumber: number,
    documentId: string,
    options: Required<PagePreviewExtractionOptions>,
  ): Promise<ExtractedImage | null> {
    try {
      const scale = options.scale ?? 1.4
      const viewport = page.getViewport({ scale })

      const canvas = document.createElement("canvas")
      const context = canvas.getContext("2d")

      if (!context) {
        return null
      }

      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)

      await page.render({
        canvasContext: context,
        viewport,
      }).promise

      // Filter out extremely small previews
      if (canvas.width < options.minWidth || canvas.height < options.minHeight) {
        canvas.remove()
        return null
      }

      const dataUrl = canvas.toDataURL("image/jpeg", options.quality)
      const image: ExtractedImage = {
        id: this.createImageId(documentId, pageNumber),
        documentId,
        pageNumber,
        position: {
          x: 0,
          y: 0,
          width: canvas.width,
          height: canvas.height,
        },
        dataUrl,
        mimeType: "image/jpeg",
        width: canvas.width,
        height: canvas.height,
        caption: `Page ${pageNumber} preview`,
        altText: `High-resolution preview for page ${pageNumber}`,
        confidence: 1,
        type: "page-preview",
        source: "pdf",
        extractedAt: new Date(),
      }

      // Cleanup
      canvas.width = 0
      canvas.height = 0
      canvas.remove()

      return image
    } catch (error) {
      console.error(`Failed to render page preview for page ${pageNumber}:`, error)
      return null
    }
  }

  /**
   * Extract inline images (figures, charts, diagrams) from PDF pages
   * Uses PDF.js operator lists to find image XObjects
   */
  async extractInlineImages(
    pdf: unknown, // PDFDocumentProxy
    documentId: string,
    options: ImageExtractionOptions = {},
    onProgress?: (progress: ImageExtractionProgress) => void,
  ): Promise<ImageExtractionResult> {
    const startTime = Date.now()
    const extractedInlineImages: ExtractedImage[] = []
    let imageCounter = 0

    const mergedOptions: Required<ImageExtractionOptions> = {
      maxImages: options.maxImages ?? this.defaultOptions.maxImages ?? 50,
      minWidth: options.minWidth ?? this.defaultOptions.minWidth ?? 64,
      minHeight: options.minHeight ?? this.defaultOptions.minHeight ?? 64,
      quality: options.quality ?? this.defaultOptions.quality ?? 0.85,
      extractMetadata: options.extractMetadata ?? this.defaultOptions.extractMetadata ?? true,
      scale: options.scale ?? this.defaultOptions.scale ?? 1.0,
    }

    const totalPages = pdf.numPages

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      if (extractedInlineImages.length >= mergedOptions.maxImages) {
        break
      }

      try {
        onProgress?.({
          stage: "Extracting inline images",
          pageNumber: pageNum,
          processed: extractedInlineImages.length,
          total: totalPages,
        })

        const page = await pdf.getPage(pageNum)
        const operatorList = await page.getOperatorList()

        // Look for image operations in the operator list
        for (let i = 0; i < operatorList.fnArray.length; i++) {
          const fn = operatorList.fnArray[i]
          const args = operatorList.argsArray[i]

          // OPS.paintImageXObject or OPS.paintInlineImageXObject
          // These are typically 85 and 88 in PDF.js internal OPS enum
          if (fn === 85 || fn === 88) {
            try {
              const imageObj = await this.extractImageFromOperator(
                page,
                args,
                pageNum,
                documentId,
                imageCounter++,
                mergedOptions,
              )

              if (imageObj && imageObj.width >= mergedOptions.minWidth && imageObj.height >= mergedOptions.minHeight) {
                extractedInlineImages.push(imageObj)

                if (extractedInlineImages.length >= mergedOptions.maxImages) {
                  break
                }
              }
            } catch (error) {
              console.warn(`Failed to extract image from page ${pageNum}:`, error)
            }
          }
        }
      } catch (error) {
        console.error(`Error scanning page ${pageNum} for images:`, error)
      }
    }

    const extractionTime = Date.now() - startTime

    onProgress?.({
      stage: "Completed inline image extraction",
      processed: extractedInlineImages.length,
      total: totalPages,
    })

    return {
      images: extractedInlineImages,
      totalFound: extractedInlineImages.length,
      extractionTime,
    }
  }

  /**
   * Extract a single image from a PDF operator
   * This is a simplified implementation - full implementation would need
   * access to PDF.js internals for proper image decoding
   */
  private async extractImageFromOperator(
    page: unknown,
    args: unknown[],
    pageNumber: number,
    documentId: string,
    imageIndex: number,
    options: Required<ImageExtractionOptions>,
  ): Promise<ExtractedImage | null> {
    try {
      // This is a placeholder implementation
      // Full implementation would require:
      // 1. Access to page.objs (PDFObjects) to get the actual image data
      // 2. Decoding the image stream (may be JPEG, PNG, or raw bitmap)
      // 3. Converting to canvas and then to data URL

      // For now, we'll render a small region of the page containing the image
      // This is less efficient but works without internal PDF.js access
      
      const viewport = page.getViewport({ scale: options.scale })
      const canvas = document.createElement("canvas")
      const context = canvas.getContext("2d")

      if (!context) {
        return null
      }

      // Use a smaller canvas for inline images
      canvas.width = Math.min(800, Math.floor(viewport.width))
      canvas.height = Math.min(800, Math.floor(viewport.height))

      // This renders the entire page - not ideal for individual images
      // but serves as a fallback until we can access page.objs properly
      await page.render({
        canvasContext: context,
        viewport: page.getViewport({ scale: canvas.width / viewport.width }),
      }).promise

      const dataUrl = canvas.toDataURL("image/jpeg", options.quality)

      const image: ExtractedImage = {
        id: `${documentId}_inline_${pageNumber}_${imageIndex}`,
        documentId,
        pageNumber,
        position: { x: 0, y: 0, width: canvas.width, height: canvas.height },
        dataUrl,
        mimeType: "image/jpeg",
        width: canvas.width,
        height: canvas.height,
        caption: `Image from page ${pageNumber}`,
        altText: `Inline image extracted from page ${pageNumber}`,
        confidence: 0.7, // Lower confidence since this is a fallback method
        type: "inline-image",
        source: "pdf",
        extractedAt: new Date(),
      }

      canvas.width = 0
      canvas.height = 0
      canvas.remove()

      return image
    } catch (error) {
      console.error(`Failed to extract image operator:`, error)
      return null
    }
  }

  /**
   * Create a unique image ID
   */
  private createImageId(documentId: string, pageNumber: number): string {
    return `${documentId}_img_${pageNumber}_${++this.imageCounter}`;
  }
}

/**
 * Image Extractor for DOCX documents
 * Extracts embedded images from Word documents using ZIP parsing
 */
export class DOCXImageExtractor {
  private imageCounter = 0

  /**
   * Extract images from a DOCX document by parsing its ZIP structure
   * DOCX files are ZIP archives with images stored in word/media/
   */
  async extractFromDocument(
    arrayBuffer: ArrayBuffer,
    documentId: string,
    options: ImageExtractionOptions = {},
  ): Promise<ImageExtractionResult> {
    const startTime = Date.now()
    const images: ExtractedImage[] = []

    const mergedOptions: Required<ImageExtractionOptions> = {
      maxImages: options.maxImages ?? 50,
      minWidth: options.minWidth ?? 32,
      minHeight: options.minHeight ?? 32,
      quality: options.quality ?? 0.85,
      extractMetadata: options.extractMetadata ?? true,
      scale: options.scale ?? 1.0,
    }

    try {
      // Dynamically import JSZip for DOCX parsing
      const JSZip = (await import('jszip')).default

      const zip = await JSZip.loadAsync(arrayBuffer)
      const mediaFolder = zip.folder('word/media')

      if (!mediaFolder) {
        console.log('No media folder found in DOCX')
        return {
          images,
          totalFound: 0,
          extractionTime: Date.now() - startTime,
        }
      }

      // Get all image files from media folder
      const imageFiles = Object.keys(zip.files).filter((name) =>
        name.startsWith('word/media/') && this.isImageFile(name)
      )

      for (const fileName of imageFiles) {
        if (images.length >= mergedOptions.maxImages) {
          break
        }

        try {
          const file = zip.files[fileName]
          const blob = await file.async('blob')
          const dataUrl = await this.blobToDataUrl(blob)

          // Get image dimensions
          const dimensions = await this.getImageDimensions(dataUrl)

          if (dimensions.width >= mergedOptions.minWidth && dimensions.height >= mergedOptions.minHeight) {
            const image: ExtractedImage = {
              id: `${documentId}_docx_img_${++this.imageCounter}`,
              documentId,
              pageNumber: undefined, // DOCX doesn't have strict page numbers for images
              position: undefined,
              dataUrl,
              mimeType: blob.type || this.getMimeTypeFromFileName(fileName),
              width: dimensions.width,
              height: dimensions.height,
              caption: `Image from ${fileName.split('/').pop()}`,
              altText: `Embedded image from Word document`,
              confidence: 1.0,
              type: "inline-image",
              source: "docx",
              extractedAt: new Date(),
            }

            images.push(image)
          }
        } catch (error) {
          console.warn(`Failed to extract image ${fileName}:`, error)
        }
      }
    } catch (error) {
      console.error('Failed to parse DOCX for images:', error)
    }

    return {
      images,
      totalFound: images.length,
      extractionTime: Date.now() - startTime,
    }
  }

  /**
   * Check if a file is an image based on extension
   */
  private isImageFile(fileName: string): boolean {
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', '.webp']
    return imageExtensions.some((ext) => fileName.toLowerCase().endsWith(ext))
  }

  /**
   * Convert Blob to base64 data URL
   */
  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  /**
   * Get image dimensions from data URL
   */
  private getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        resolve({ width: img.width, height: img.height })
      }
      img.onerror = () => {
        resolve({ width: 0, height: 0 })
      }
      img.src = dataUrl
    })
  }

  /**
   * Determine MIME type from file name
   */
  private getMimeTypeFromFileName(fileName: string): string {
    const ext = fileName.toLowerCase().split('.').pop()
    const mimeTypes: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      bmp: 'image/bmp',
      svg: 'image/svg+xml',
      webp: 'image/webp',
    }
    return mimeTypes[ext || ''] || 'image/jpeg'
  }
}

