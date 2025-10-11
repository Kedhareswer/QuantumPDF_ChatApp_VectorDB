export interface TextChunk {
  content: string
  metadata: {
    index: number
    startChar: number
    endChar: number
    wordCount: number
    type: "paragraph" | "heading" | "list" | "table" | "other"
    confidence: number
    documentId?: string
    documentName?: string
    semanticImportance: number
    keywordDensity: number
  }
}

export interface ChunkingOptions {
  maxChunkSize: number
  minChunkSize: number
  overlap: number
  preserveStructure: boolean
  semanticSplitting: boolean
  documentAware: boolean
  adaptiveThreshold: boolean
}

export class AdvancedChunker {
  private options: ChunkingOptions

  constructor(options: ChunkingOptions) {
    this.options = {
      ...options,
      documentAware: options.documentAware ?? true,
      adaptiveThreshold: options.adaptiveThreshold ?? true
    }
  }

  chunkText(text: string, documentId?: string, documentName?: string): TextChunk[] {
    if (!text || text.trim().length === 0) {
      return []
    }

    const chunks: TextChunk[] = []
    
    if (this.options.semanticSplitting && this.options.documentAware) {
      return this.semanticChunking(text, documentId, documentName)
    }
    
    const paragraphs = this.splitIntoParagraphs(text)
    let currentChunk = ""
    let chunkStartChar = 0
    let chunkIndex = 0

    for (const paragraph of paragraphs) {
      const adaptiveMaxSize = this.getAdaptiveChunkSize(paragraph, currentChunk)
      
      if (currentChunk.length + paragraph.length > adaptiveMaxSize && currentChunk.length > 0) {
        // Create chunk from current content
        chunks.push(this.createChunk(currentChunk, chunkIndex, chunkStartChar, documentId, documentName))

        // Start new chunk with overlap
        const overlapText = this.getOverlapText(currentChunk)
        currentChunk = overlapText + paragraph
        chunkStartChar = chunkStartChar + currentChunk.length - overlapText.length - paragraph.length
        chunkIndex++
      } else {
        if (currentChunk.length === 0) {
          chunkStartChar = text.indexOf(paragraph)
        }
        currentChunk += (currentChunk.length > 0 ? "\n\n" : "") + paragraph
      }
    }

    // Add final chunk
    if (currentChunk.trim().length > 0) {
      chunks.push(this.createChunk(currentChunk, chunkIndex, chunkStartChar, documentId, documentName))
    }

    return chunks
  }

  private splitIntoParagraphs(text: string): string[] {
    return text
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
  }

  private getOverlapText(text: string): string {
    const sentences = text.split(/[.!?]+/)
    const overlapSize = Math.min(this.options.overlap, text.length / 2)

    let overlap = ""
    for (let i = sentences.length - 1; i >= 0 && overlap.length < overlapSize; i--) {
      const sentence = sentences[i].trim()
      if (sentence.length > 0) {
        overlap = sentence + ". " + overlap
      }
    }

    return overlap.trim()
  }

  private createChunk(content: string, index: number, startChar: number, documentId?: string, documentName?: string): TextChunk {
    const trimmedContent = content.trim()
    const wordCount = trimmedContent.split(/\s+/).length

    return {
      content: trimmedContent,
      metadata: {
        index,
        startChar,
        endChar: startChar + trimmedContent.length,
        wordCount,
        type: this.detectChunkType(trimmedContent),
        confidence: this.calculateChunkConfidence(trimmedContent),
        documentId,
        documentName,
        semanticImportance: this.calculateSemanticImportance(trimmedContent),
        keywordDensity: this.calculateKeywordDensity(trimmedContent),
      },
    }
  }

  private detectChunkType(content: string): "paragraph" | "heading" | "list" | "table" | "other" {
    if (content.length < 50 && /^[A-Z][^.!?]*$/.test(content.trim())) {
      return "heading"
    }

    if (content.includes("•") || content.includes("-") || /^\d+\./.test(content)) {
      return "list"
    }

    if (content.includes("|") || content.includes("\t")) {
      return "table"
    }

    if (content.length > 50 && content.includes(".")) {
      return "paragraph"
    }

    return "other"
  }

  private calculateChunkConfidence(content: string): number {
    let confidence = 50

    if (content.length > 100) confidence += 20
    if (content.includes(".")) confidence += 10
    if (/[A-Z]/.test(content)) confidence += 10
    if (content.split(/\s+/).length > 10) confidence += 10

    return Math.min(100, confidence)
  }

  private semanticChunking(text: string, documentId?: string, documentName?: string): TextChunk[] {
    const chunks: TextChunk[] = []
    const sections = this.identifySemanticSections(text)

    let chunkIndex = 0
    for (const section of sections) {
      const trimmedContent = section.content.trim()

      // Skip very small sections
      if (trimmedContent.length < this.options.minChunkSize) {
        // Try to merge with previous chunk if exists
        if (chunks.length > 0 && chunks[chunks.length - 1].content.length + trimmedContent.length < this.options.maxChunkSize) {
          chunks[chunks.length - 1].content += '\n\n' + trimmedContent
          chunks[chunks.length - 1].metadata.endChar = section.startChar + trimmedContent.length
          chunks[chunks.length - 1].metadata.wordCount = chunks[chunks.length - 1].content.split(/\s+/).length
          continue
        } else {
          continue // Skip if can't merge
        }
      }

      if (trimmedContent.length <= this.options.maxChunkSize) {
        // Section fits in one chunk
        chunks.push(this.createChunk(trimmedContent, chunkIndex, section.startChar, documentId, documentName))
        chunkIndex++
      } else {
        // Split large section into smaller chunks with semantic boundaries
        const subChunks = this.splitLargeSection(section)
        subChunks.forEach(subChunk => {
          if (subChunk.content.trim().length >= this.options.minChunkSize) {
            chunks.push(this.createChunk(subChunk.content, chunkIndex, subChunk.startChar, documentId, documentName))
            chunkIndex++
          }
        })
      }
    }

    return chunks
  }

  private identifySemanticSections(text: string): Array<{content: string, startChar: number}> {
    const sections: Array<{content: string, startChar: number}> = []
    const lines = text.split('\n')
    
    let currentSection = ''
    let sectionStart = 0
    let currentPos = 0
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineLength = line.length + 1 // +1 for newline
      
      // Check for section boundaries
      if (this.isSemanticBoundary(line, lines[i - 1], lines[i + 1])) {
        if (currentSection.trim()) {
          sections.push({ content: currentSection.trim(), startChar: sectionStart })
        }
        currentSection = line
        sectionStart = currentPos
      } else {
        currentSection += (currentSection ? '\n' : '') + line
      }
      
      currentPos += lineLength
    }
    
    // Add final section
    if (currentSection.trim()) {
      sections.push({ content: currentSection.trim(), startChar: sectionStart })
    }
    
    return sections
  }

  private isSemanticBoundary(currentLine: string, prevLine?: string, nextLine?: string): boolean {
    const trimmedCurrent = currentLine.trim()
    const trimmedPrev = prevLine?.trim()

    // Strong heading patterns (Markdown or plain text)
    if (/^#{1,6}\s/.test(trimmedCurrent)) return true // Markdown headings
    if (/^[A-Z][^.!?]{0,50}:?\s*$/.test(trimmedCurrent) && trimmedCurrent.length < 60) return true // Short capitalized lines

    // Numbered section headers (1. Introduction, 2.1 Methods, etc.)
    if (/^\d+(\.\d+)*\.?\s+[A-Z]/.test(trimmedCurrent)) return true

    // Bulleted or numbered list starts (after paragraph)
    if (trimmedPrev && !/^[•\-\*\d]/.test(trimmedPrev) && /^[•\-\*]\s|^\d+\.\s/.test(trimmedCurrent)) {
      return true
    }

    // Paragraph transitions: empty line followed by new paragraph
    if (!trimmedPrev && trimmedCurrent && nextLine?.trim()) return true

    // Major topic shifts indicated by all-caps lines or underlines
    if (/^[A-Z\s]{4,}$/.test(trimmedCurrent) && trimmedCurrent.length < 100) return true
    if (/^[=\-_]{3,}$/.test(trimmedCurrent)) return true // Underlines

    // Quote or blockquote starts
    if (/^>/.test(trimmedCurrent)) return true

    // Code block boundaries
    if (/^```/.test(trimmedCurrent)) return true

    return false
  }

  private splitLargeSection(section: {content: string, startChar: number}): Array<{content: string, startChar: number}> {
    const chunks: Array<{content: string, startChar: number}> = []
    const sentences = this.splitIntoSentences(section.content)
    
    let currentChunk = ''
    let chunkStart = section.startChar
    let currentPos = section.startChar
    
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > this.options.maxChunkSize && currentChunk.length > 0) {
        chunks.push({ content: currentChunk.trim(), startChar: chunkStart })
        
        // Start new chunk with overlap
        const overlapSentences = this.getOverlapSentences(currentChunk)
        currentChunk = overlapSentences + sentence
        chunkStart = currentPos - overlapSentences.length
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence
      }
      
      currentPos += sentence.length + 1
    }
    
    if (currentChunk.trim()) {
      chunks.push({ content: currentChunk.trim(), startChar: chunkStart })
    }
    
    return chunks
  }

  private splitIntoSentences(text: string): string[] {
    return text.match(/[^.!?]+[.!?]+/g) || [text]
  }

  private getOverlapSentences(text: string): string {
    const sentences = this.splitIntoSentences(text)
    const overlapCount = Math.min(2, sentences.length - 1)
    return sentences.slice(-overlapCount).join(' ')
  }

  private getAdaptiveChunkSize(paragraph: string, currentChunk: string): number {
    if (!this.options.adaptiveThreshold) {
      return this.options.maxChunkSize
    }
    
    // Adjust chunk size based on content type
    const chunkType = this.detectChunkType(paragraph)
    const multiplier = {
      'heading': 0.5,
      'list': 0.8,
      'table': 1.2,
      'paragraph': 1.0,
      'other': 0.9
    }[chunkType] || 1.0
    
    return Math.floor(this.options.maxChunkSize * multiplier)
  }

  private calculateSemanticImportance(content: string): number {
    let importance = 50 // Base importance

    const trimmedContent = content.trim()

    // Strong indicators of important content
    // Headings and titles (very high importance)
    if (/^#{1,3}\s/.test(trimmedContent)) importance += 35 // High-level markdown headings
    else if (/^#{4,6}\s/.test(trimmedContent)) importance += 25 // Lower-level headings
    else if (/^[A-Z][^.!?]{0,50}:?\s*$/.test(trimmedContent) && trimmedContent.length < 60) {
      importance += 30 // Short capitalized title lines
    }

    // Numbered sections (structural importance)
    if (/^\d+(\.\d+)*\.?\s+[A-Z]/.test(trimmedContent)) importance += 20

    // Key content indicators
    const keyTerms = /\b(abstract|summary|introduction|conclusion|objective|purpose|method|result|finding|key|important|critical|significant|main|primary|essential|fundamental)\b/i
    if (keyTerms.test(trimmedContent)) importance += 15

    // Numerical data and statistics (often important)
    if (/\d{4}/.test(trimmedContent)) importance += 5 // Years/dates
    if (/\d+%|\$\d+|€\d+|£\d+/.test(trimmedContent)) importance += 8 // Percentages, currency
    if (/\b(table|figure|chart|graph|diagram)\b/i.test(trimmedContent)) importance += 12

    // Structured content (lists, tables)
    if (/^[•\-\*]\s|^\d+\.\s/m.test(trimmedContent)) importance += 8
    if (/\|.*\|/m.test(trimmedContent)) importance += 10 // Tables

    // Proper nouns and named entities (context-rich)
    const properNounMatches = trimmedContent.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || []
    const uniqueProperNouns = new Set(properNounMatches).size
    importance += Math.min(uniqueProperNouns * 1.5, 15)

    // Citations and references (academic/technical importance)
    if (/\[\d+\]|\([A-Z][a-z]+,?\s+\d{4}\)/.test(trimmedContent)) importance += 8

    // Quotations (potentially important attributed content)
    if (/"[^"]{20,}"/.test(trimmedContent)) importance += 5

    // Length factor: very short or very long chunks may be less semantically complete
    const wordCount = trimmedContent.split(/\s+/).length
    if (wordCount < 20) importance -= 10 // Too short, likely fragment
    else if (wordCount > 200) importance -= 5 // Very long, may be less focused

    // Density bonus: well-structured content with good sentence complexity
    const sentences = trimmedContent.split(/[.!?]+/).filter(s => s.trim().length > 10)
    if (sentences.length >= 3) {
      const avgSentenceLength = wordCount / sentences.length
      if (avgSentenceLength > 10 && avgSentenceLength < 30) importance += 5 // Good structure
    }

    return Math.max(10, Math.min(100, importance))
  }

  private calculateKeywordDensity(content: string): number {
    const words = content.toLowerCase().split(/\s+/)
    const uniqueWords = new Set(words)
    return (uniqueWords.size / words.length) * 100
  }
}
