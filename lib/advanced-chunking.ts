export interface TextChunk {
  content: string
  metadata: {
    index: number
    startChar: number
    endChar: number
    wordCount: number
    type: "paragraph" | "heading" | "list" | "table" | "code" | "image" | "other"
    confidence: number
    documentId?: string
    documentName?: string
    semanticImportance: number
    keywordDensity: number
    // Optional fields used by downstream components when available
    page?: number
    bbox?: any
    level?: number
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

    let chunks: TextChunk[] = []

    // Primary path: semantic, document-aware chunking
    if (this.options.semanticSplitting && this.options.documentAware) {
      chunks = this.semanticChunking(text, documentId, documentName)
    } else {
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
    }

    // Safety net: ensure at least one chunk for any non-empty text
    if (chunks.length === 0 && text.trim().length > 0) {
      return [this.createChunk(text.trim(), 0, 0, documentId, documentName)]
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

  private detectChunkType(content: string): "paragraph" | "heading" | "list" | "table" | "code" | "image" | "other" {
    if (this.isLikelyImageCaption(content)) return "image"
    if (this.isLikelyCode(content)) return "code"

    if (content.length < 50 && /^[A-Z][^.!?]*$/.test(content.trim())) {
      return "heading"
    }

    if (content.includes("•") || content.includes("-") || /^\d+\./.test(content)) {
      return "list"
    }

    if (this.isLikelyTable(content)) {
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
    let inCodeBlock = false
    let inTableBlock = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineLength = line.length + 1 // +1 for newline

      const trimmed = line.trim()

      // Handle fenced code blocks
      if (/^```/.test(trimmed)) {
        if (!inCodeBlock) {
          // Starting a code block: flush previous section
          if (currentSection.trim()) {
            sections.push({ content: currentSection.trim(), startChar: sectionStart })
          }
          currentSection = line
          sectionStart = currentPos
          inCodeBlock = true
        } else {
          // Closing a code block
          currentSection += (currentSection ? '\n' : '') + line
          sections.push({ content: currentSection.trim(), startChar: sectionStart })
          currentSection = ''
          sectionStart = currentPos + lineLength
          inCodeBlock = false
        }
        currentPos += lineLength
        continue
      }

      // If inside a fenced code block, keep accumulating lines as-is
      if (inCodeBlock) {
        currentSection += (currentSection ? '\n' : '') + line
        currentPos += lineLength
        continue
      }

      // Detect table block starts/continues
      const isTableLine = this.isTableLine(line)
      if (isTableLine) {
        if (!inTableBlock) {
          // Starting a table block: flush previous section
          if (currentSection.trim()) {
            sections.push({ content: currentSection.trim(), startChar: sectionStart })
          }
          currentSection = line
          sectionStart = currentPos
          inTableBlock = true
        } else {
          // Continuing an existing table block
          currentSection += (currentSection ? '\n' : '') + line
        }
        currentPos += lineLength
        continue
      }

      // If we were in a table block and encounter a non-table line, close the table block
      if (inTableBlock && !isTableLine) {
        if (currentSection.trim()) {
          sections.push({ content: currentSection.trim(), startChar: sectionStart })
        }
        currentSection = ''
        sectionStart = currentPos
        inTableBlock = false
      }

      // Image captions or figure references as standalone sections
      if (this.isLikelyImageCaption(line)) {
        if (currentSection.trim()) {
          sections.push({ content: currentSection.trim(), startChar: sectionStart })
        }
        sections.push({ content: line.trim(), startChar: currentPos })
        currentSection = ''
        sectionStart = currentPos + lineLength
        currentPos += lineLength
        continue
      }

      // General semantic boundaries (headings, lists, etc.)
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

    // Close any open table block
    if (inTableBlock && currentSection.trim()) {
      sections.push({ content: currentSection.trim(), startChar: sectionStart })
      currentSection = ''
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
    const content = section.content
    const isCode = this.isLikelyCode(content)
    const isTable = this.isLikelyTable(content)

    // For code and tables: split by lines to avoid breaking semantics
    if (isCode || isTable) {
      const chunks: Array<{content: string, startChar: number}> = []
      const lines = content.split('\n')

      let buf = ''
      let bufStart = section.startChar

      // Map each line to its start char relative to the section
      const lineStarts: number[] = []
      let rel = 0
      for (const l of lines) {
        lineStarts.push(rel)
        rel += l.length + 1 // include newline
      }

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const lineWithNl = (buf ? '\n' : '') + line
        if (buf.length + lineWithNl.length > this.options.maxChunkSize && buf.length > 0) {
          // flush
          const relStart = lineStarts[i - buf.split('\n').length]
          chunks.push({ content: buf.trim(), startChar: section.startChar + relStart })
          buf = ''
        }
        buf += lineWithNl
      }
      if (buf.trim()) {
        const relStart = content.length - buf.length
        chunks.push({ content: buf.trim(), startChar: section.startChar + Math.max(0, relStart) })
      }
      return chunks
    }

    // Default: sentence-based splitting
    const chunks: Array<{content: string, startChar: number}> = []
    const sentences = this.splitIntoSentences(content)

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
      'code': 1.5,
      'image': 0.6,
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

  // Heuristics
  private isLikelyCode(content: string): boolean {
    const trimmed = content.trim()
    if (/^```/.test(trimmed) || /```$/.test(trimmed)) return true
    const lines = trimmed.split('\n')
    const indentedLines = lines.filter(l => /^\s{4,}/.test(l)).length
    const symbolHeavy = /[{};()\[\]<>\/=+\-*%]|\b(function|class|def|const|let|var|import|export|public|private|static|if|else|for|while|return|try|catch)\b/.test(trimmed)
    const averageLineLen = lines.reduce((a, b) => a + b.length, 0) / Math.max(1, lines.length)
    return (indentedLines >= Math.max(2, Math.floor(lines.length * 0.3))) || (symbolHeavy && averageLineLen > 20)
  }

  private isTableLine(line: string): boolean {
    const t = line.trim()
    if (!t) return false
    // Markdown style table or visually separated columns
    if ((t.includes('|') && (t.split('|').length - 1) >= 2)) return true
    if (/^\s*[-:]{2,}\s*(\|\s*[-:]{2,}\s*)+$/.test(t)) return true // header separator
    if (/^[\u2500-\u257F\-\+\|]+$/.test(t)) return true // box drawing characters
    // multiple consecutive spaces separating columns
    if (/\S\s{2,}\S/.test(t) && t.split(/\s{2,}/).length >= 3) return true
    return false
  }

  private isLikelyTable(content: string): boolean {
    const lines = content.split('\n')
    const tableLines = lines.filter(l => this.isTableLine(l)).length
    return tableLines >= Math.max(2, Math.floor(lines.length * 0.4))
  }

  private isLikelyImageCaption(content: string): boolean {
    const t = content.trim()
    if (!t) return false
    if (/^!\[.*\]\(.*\)/.test(t)) return true // markdown image
    if (/^(figure|fig\.|image|diagram|chart|graph)\b/i.test(t)) return true
    if (/This page appears to be image-based/i.test(t)) return true
    return false
  }
}
