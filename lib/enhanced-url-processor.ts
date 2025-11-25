/**
 * Enhanced URL Content Processor
 * Handles fetching and processing content from various URL types including PDFs, arXiv papers, and web pages
 */

import { AIClient } from './ai-client'
import * as pdfjsLib from 'pdfjs-dist'

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  const workerOptions = (pdfjsLib as any).GlobalWorkerOptions
  const pdfjsVersion = (pdfjsLib as any).version || '3.11.174'
  if (workerOptions) {
    workerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsVersion}/pdf.worker.min.js`
  }
}

export interface ProcessedContent {
  id: string
  url: string
  title: string
  content: string
  contentType: 'pdf' | 'html' | 'text' | 'arxiv' | 'unknown'
  metadata: {
    authors?: string[]
    publishedAt?: string
    abstract?: string
    keywords?: string[]
    wordCount: number
    language?: string
    title?: string
    pageCount?: number
  }
  chunks: Array<{
    id: string
    content: string
    metadata: Record<string, any>
  }>
  error?: string
}

export interface URLProcessorConfig {
  maxContentLength?: number
  chunkSize?: number
  chunkOverlap?: number
  enablePDFProcessing?: boolean
  enableArxivProcessing?: boolean
  aiConfig?: {
    provider: string
    apiKey: string
    model: string
    baseUrl?: string
  }
}

export class EnhancedURLProcessor {
  private config: URLProcessorConfig
  private aiClient?: AIClient

  constructor(config: URLProcessorConfig = {}) {
    this.config = {
      maxContentLength: 50000, // 50KB max content
      chunkSize: 1000,
      chunkOverlap: 200,
      enablePDFProcessing: true,
      enableArxivProcessing: true,
      ...config
    }

    if (this.config.aiConfig) {
      this.aiClient = new AIClient({
        provider: this.config.aiConfig.provider as any,
        apiKey: this.config.aiConfig.apiKey,
        model: this.config.aiConfig.model,
        baseUrl: this.config.aiConfig.baseUrl
      })
    }
  }

  async processURL(url: string): Promise<ProcessedContent> {
    try {
      const sanitizedUrl = this.sanitizeUrl(url)
      if (!this.isValidHttpUrl(sanitizedUrl)) {
        throw new Error('Invalid URL provided')
      }

      const urlObj = new URL(sanitizedUrl)
      if (this.isPrivateHostname(urlObj.hostname)) {
        throw new Error('Private/local URLs are not allowed')
      }

      // Detect URL type and route to appropriate processor
      if (this.isArxivUrl(sanitizedUrl)) {
        return await this.processArxivPaper(sanitizedUrl)
      } else if (this.isPDFUrl(sanitizedUrl)) {
        return await this.processPDFUrl(sanitizedUrl)
      } else {
        return await this.processWebPage(sanitizedUrl)
      }
    } catch (error) {
      return {
        id: url,
        url,
        title: 'Error Processing URL',
        content: '',
        contentType: 'unknown',
        metadata: { wordCount: 0 },
        chunks: [],
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  private async processArxivPaper(url: string): Promise<ProcessedContent> {
    try {
      // Extract arXiv ID from URL
      const arxivId = this.extractArxivId(url)
      if (!arxivId) {
        throw new Error('Could not extract arXiv ID from URL')
      }

      // Fetch paper metadata from arXiv API
      const apiUrl = `https://export.arxiv.org/api/query?id_list=${arxivId}`
      const response = await fetch(apiUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch arXiv metadata: ${response.status}`)
      }

      const xmlText = await response.text()
      const metadata = this.parseArxivXML(xmlText)

      // Try to fetch the abstract page for additional content
      let abstractContent = ''
      try {
        const abstractUrl = `https://arxiv.org/abs/${arxivId}`
        const abstractResponse = await fetch(abstractUrl, {
          headers: { 'User-Agent': 'QuantumPDF-ChatApp/1.0' }
        })
        if (abstractResponse.ok) {
          const html = await abstractResponse.text()
          abstractContent = this.extractArxivAbstractFromHTML(html)
        }
      } catch {
        // Fallback to API abstract
        abstractContent = metadata.abstract || ''
      }

      // Combine all available content
      const fullContent = this.combineArxivContent(metadata, abstractContent)
      const chunks = this.createContentChunks(fullContent, url, metadata)

      return {
        id: arxivId,
        url,
        title: metadata.title || `arXiv:${arxivId}`,
        content: fullContent,
        contentType: 'arxiv',
        metadata: {
          ...metadata,
          wordCount: fullContent.split(/\s+/).length
        },
        chunks
      }
    } catch (error) {
      throw new Error(`Failed to process arXiv paper: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async processPDFUrl(url: string): Promise<ProcessedContent> {
    if (!this.config.enablePDFProcessing) {
      throw new Error('PDF processing is disabled')
    }

    try {
      console.log(`Processing PDF from URL: ${url}`)
      
      // Fetch the PDF file
      const response = await fetch(url, {
        headers: { 'User-Agent': 'QuantumPDF-ChatApp/1.0' }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`)
      }

      const contentType = response.headers.get('content-type') || ''
      if (!contentType.includes('application/pdf') && !url.toLowerCase().endsWith('.pdf')) {
        throw new Error(`URL does not appear to be a PDF (content-type: ${contentType})`)
      }

      // Get the PDF as ArrayBuffer
      const pdfData = await response.arrayBuffer()
      const contentLength = pdfData.byteLength
      const title = this.extractTitleFromUrl(url)

      console.log(`PDF downloaded: ${Math.round(contentLength / 1024)} KB`)

      // Extract text using PDF.js
      let extractedText = ''
      let pageCount = 0
      let pdfMetadata: any = {}

      try {
        const loadingTask = (pdfjsLib as any).getDocument({
          data: new Uint8Array(pdfData),
          useWorkerFetch: false,
          isEvalSupported: false,
          useSystemFonts: true,
        })

        const pdf = await loadingTask.promise
        pageCount = pdf.numPages
        console.log(`PDF has ${pageCount} pages`)

        // Get metadata
        try {
          const metadata = await pdf.getMetadata()
          pdfMetadata = {
            title: metadata.info?.Title || title,
            author: metadata.info?.Author,
            subject: metadata.info?.Subject,
            keywords: metadata.info?.Keywords,
            creator: metadata.info?.Creator,
            producer: metadata.info?.Producer,
            creationDate: metadata.info?.CreationDate,
          }
        } catch (metaError) {
          console.warn('Could not extract PDF metadata:', metaError)
        }

        // Extract text from each page
        for (let i = 1; i <= pageCount; i++) {
          try {
            const page = await pdf.getPage(i)
            const textContent = await page.getTextContent()
            const pageText = textContent.items
              .filter((item: any) => 'str' in item)
              .map((item: any) => item.str)
              .join(' ')
            
            if (pageText.trim()) {
              extractedText += `\n\n--- Page ${i} ---\n\n${pageText}`
            }
          } catch (pageError) {
            console.warn(`Error extracting text from page ${i}:`, pageError)
          }
        }

        extractedText = extractedText.trim()
      } catch (pdfError) {
        console.error('PDF.js extraction failed:', pdfError)
        // Fall back to basic info if PDF.js fails
        extractedText = ''
      }

      // If extraction failed or yielded no text, provide fallback
      if (!extractedText) {
        extractedText = `PDF Document: ${pdfMetadata.title || title}

This PDF could not be fully processed (it may be image-based or encrypted).

PDF Details:
- URL: ${url}
- Size: ${Math.round(contentLength / 1024)} KB
- Pages: ${pageCount || 'Unknown'}
${pdfMetadata.author ? `- Author: ${pdfMetadata.author}` : ''}
${pdfMetadata.subject ? `- Subject: ${pdfMetadata.subject}` : ''}

For full content analysis of image-based PDFs:
1. Download the PDF from the URL above
2. Upload it directly to enable OCR processing`
      }

      // Truncate if too long
      if (extractedText.length > this.config.maxContentLength!) {
        extractedText = extractedText.substring(0, this.config.maxContentLength!) + '\n\n[Content truncated...]'
      }

      const chunks = this.createContentChunks(extractedText, url, {
        title: pdfMetadata.title || title,
        ...pdfMetadata
      })

      return {
        id: url,
        url,
        title: pdfMetadata.title || title || 'PDF Document',
        content: extractedText,
        contentType: 'pdf',
        metadata: {
          title: pdfMetadata.title || title,
          authors: pdfMetadata.author ? [pdfMetadata.author] : undefined,
          keywords: pdfMetadata.keywords ? pdfMetadata.keywords.split(/[,;]/).map((k: string) => k.trim()) : undefined,
          wordCount: extractedText.split(/\s+/).length,
          pageCount
        },
        chunks
      }
    } catch (error) {
      console.error('PDF URL processing error:', error)
      throw new Error(`Failed to process PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async processWebPage(url: string): Promise<ProcessedContent> {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'QuantumPDF-ChatApp/1.0' }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch webpage: ${response.status}`)
      }

      const contentType = response.headers.get('content-type') || ''
      let content = ''
      let title = url

      if (contentType.includes('text/html')) {
        const html = await response.text()
        const extracted = this.extractContentFromHTML(html)
        content = extracted.content
        title = extracted.title || title
      } else if (contentType.includes('text/plain')) {
        content = await response.text()
        title = this.extractTitleFromUrl(url)
      } else {
        throw new Error(`Unsupported content type: ${contentType}`)
      }

      // Truncate if too long
      if (content.length > this.config.maxContentLength!) {
        content = content.substring(0, this.config.maxContentLength!) + '\n\n[Content truncated...]'
      }

      const chunks = this.createContentChunks(content, url, { title })

      return {
        id: url,
        url,
        title,
        content,
        contentType: 'html',
        metadata: {
          title,
          wordCount: content.split(/\s+/).length
        },
        chunks
      }
    } catch (error) {
      throw new Error(`Failed to process webpage: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private extractContentFromHTML(html: string): { content: string; title?: string } {
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    const title = titleMatch?.[1]?.replace(/\s+/g, ' ').trim()

    // Extract main content (prioritize article, main, or body content)
    let content = ''
    
    // Try to find article content
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
    if (articleMatch) {
      content = articleMatch[1]
    } else {
      // Try main content
      const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
      if (mainMatch) {
        content = mainMatch[1]
      } else {
        // Fallback to body
        const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
        content = bodyMatch?.[1] || html
      }
    }

    // Clean HTML tags and normalize whitespace
    content = content
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    return { content, title }
  }

  private extractArxivAbstractFromHTML(html: string): string {
    // Extract abstract from arXiv abstract page
    const abstractMatch = html.match(/<blockquote class="abstract[^"]*"[^>]*>([\s\S]*?)<\/blockquote>/i)
    if (abstractMatch) {
      return abstractMatch[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    }
    return ''
  }

  private parseArxivXML(xml: string): any {
    const entry = xml.split('<entry>')[1]?.split('</entry>')[0]
    if (!entry) return {}

    const title = (entry.match(/<title>([\s\S]*?)<\/title>/) || [])[1]?.trim().replace(/\s+/g, ' ')
    const abstract = (entry.match(/<summary>([\s\S]*?)<\/summary>/) || [])[1]?.trim().replace(/\s+/g, ' ')
    const published = (entry.match(/<published>([\s\S]*?)<\/published>/) || [])[1]?.trim()
    const authors = Array.from(entry.matchAll(/<name>([\s\S]*?)<\/name>/g)).map(m => m[1].trim())
    const categories = Array.from(entry.matchAll(/<category[^>]*term="([^"]+)"/g)).map(m => m[1])

    return {
      title,
      abstract,
      authors,
      publishedAt: published,
      keywords: categories
    }
  }

  private combineArxivContent(metadata: any, abstractContent: string): string {
    let content = ''
    
    if (metadata.title) {
      content += `# ${metadata.title}\n\n`
    }
    
    if (metadata.authors?.length) {
      content += `**Authors:** ${metadata.authors.join(', ')}\n\n`
    }
    
    if (metadata.publishedAt) {
      content += `**Published:** ${new Date(metadata.publishedAt).toLocaleDateString()}\n\n`
    }
    
    if (metadata.keywords?.length) {
      content += `**Categories:** ${metadata.keywords.join(', ')}\n\n`
    }
    
    const abstract = abstractContent || metadata.abstract
    if (abstract) {
      content += `## Abstract\n\n${abstract}\n\n`
    }
    
    content += `**Note:** This is the abstract and metadata for this arXiv paper. For full content analysis, please download and upload the PDF version.`
    
    return content
  }

  private createContentChunks(content: string, url: string, metadata: any): Array<{ id: string; content: string; metadata: Record<string, any> }> {
    const chunks = []
    const chunkSize = this.config.chunkSize!
    const overlap = this.config.chunkOverlap!
    
    for (let i = 0; i < content.length; i += chunkSize - overlap) {
      const chunk = content.substring(i, i + chunkSize)
      chunks.push({
        id: `${url}_chunk_${chunks.length}`,
        content: chunk,
        metadata: {
          source: url,
          chunkIndex: chunks.length,
          ...metadata
        }
      })
    }
    
    return chunks
  }

  private isArxivUrl(url: string): boolean {
    return /arxiv\.org\/(abs|pdf)\//.test(url)
  }

  private isPDFUrl(url: string): boolean {
    return url.toLowerCase().endsWith('.pdf') || url.includes('/pdf/')
  }

  private extractArxivId(url: string): string | null {
    const match = url.match(/arxiv\.org\/(?:abs|pdf)\/([^/?]+)/)
    return match?.[1] || null
  }

  private extractTitleFromUrl(url: string): string {
    try {
      const urlObj = new URL(url)
      const pathname = urlObj.pathname
      const filename = pathname.split('/').pop() || ''
      return decodeURIComponent(filename).replace(/\.(pdf|html?)$/i, '') || urlObj.hostname
    } catch {
      return url
    }
  }

  private sanitizeUrl(url: string): string {
    return url.trim()
  }

  private isValidHttpUrl(url: string): boolean {
    try {
      const u = new URL(url)
      return u.protocol === 'http:' || u.protocol === 'https:'
    } catch {
      return false
    }
  }

  private isPrivateHostname(host: string): boolean {
    const h = host.toLowerCase()
    if (h === 'localhost' || h === '127.0.0.1' || h === '::1') return true
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(h)) return true
    if (/^169\.254\./.test(h)) return true
    if (h.endsWith('.local') || h.endsWith('.internal')) return true
    return false
  }
}

// Utility function for easy integration
export async function processURLContent(url: string, config?: URLProcessorConfig): Promise<ProcessedContent> {
  const processor = new EnhancedURLProcessor(config)
  return await processor.processURL(url)
}
