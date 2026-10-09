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
    bbox?: unknown
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
        const adaptiveMaxSize = this.getAdaptiveChunkSize(paragraph)

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
    // A small section that could not be merged backwards (e.g. the document's
    // title, or a heading after a full chunk) is carried into the next section
    // instead of being dropped.
    let carry: { content: string; startChar: number } | null = null
    const appendToLast = (content: string, endChar: number): boolean => {
      const last = chunks[chunks.length - 1]
      if (!last || last.content.length + content.length >= this.options.maxChunkSize) return false
      last.content += '\n\n' + content
      last.metadata.endChar = endChar
      last.metadata.wordCount = last.content.split(/\s+/).length
      return true
    }

    for (const rawSection of sections) {
      const section: { content: string; startChar: number } = carry
        ? { content: `${carry.content}\n\n${rawSection.content.trim()}`, startChar: carry.startChar }
        : rawSection
      carry = null
      const trimmedContent: string = section.content.trim()
      if (!trimmedContent) continue

      if (trimmedContent.length < this.options.minChunkSize) {
        // Headings belong with what follows them; other fragments with what precedes.
        const isHeading = this.detectChunkType(trimmedContent) === 'heading'
        if (isHeading || !appendToLast(trimmedContent, section.startChar + trimmedContent.length)) {
          carry = { content: trimmedContent, startChar: section.startChar }
        }
        continue
      }

      if (trimmedContent.length <= this.options.maxChunkSize) {
        // Section fits in one chunk
        chunks.push(this.createChunk(trimmedContent, chunkIndex, section.startChar, documentId, documentName))
        chunkIndex++
      } else {
        // Split large section into smaller chunks with semantic boundaries
        const subChunks = this.splitLargeSection(section)
        subChunks.forEach(subChunk => {
          const content = subChunk.content.trim()
          if (!content) return
          // A short tail still carries text: attach it rather than drop it.
          if (content.length < this.options.minChunkSize && appendToLast(content, subChunk.startChar + content.length)) return
          chunks.push(this.createChunk(content, chunkIndex, subChunk.startChar, documentId, documentName))
          chunkIndex++
        })
      }
    }

    if (carry && !appendToLast(carry.content, carry.startChar + carry.content.length)) {
      // Whole document shorter than minChunkSize (or a trailing fragment that
      // won't fit): keep it as its own chunk.
      chunks.push(this.createChunk(carry.content, chunkIndex, carry.startChar, documentId, documentName))
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
        currentChunk = overlapSentences ? `${overlapSentences} ${sentence}` : sentence
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
    // The `$` alternative keeps trailing text with no end punctuation (list
    // items, PDF lines), which the old pattern silently dropped.
    const sentences = (text.match(/[^.!?]+(?:[.!?]+|$)/g) || []).map((s) => s.trim()).filter(Boolean)
    return sentences.length > 0 ? sentences : [text]
  }

  private getOverlapSentences(text: string): string {
    const sentences = this.splitIntoSentences(text)
    const overlapCount = Math.min(2, sentences.length - 1)
    // slice(-0) would return the whole chunk as "overlap"
    return overlapCount > 0 ? sentences.slice(-overlapCount).join(' ') : ''
  }

  private getAdaptiveChunkSize(paragraph: string): number {
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

/**
 * The chunking settings every extraction engine uses. Both the PDF path
 * (liteparse-client.ts) and the non-PDF path (anydoc-client.ts) feed the same
 * vector index, so they must chunk identically — tuning one and not the other
 * shifts retrieval quality in ways that only show up at query time.
 */
export const DEFAULT_CHUNK_OPTIONS: ChunkingOptions = {
  maxChunkSize: 1000,
  minChunkSize: 250,
  overlap: 100,
  preserveStructure: true,
  semanticSplitting: true,
  documentAware: true,
  adaptiveThreshold: true,
}

/**
 * 1-based page containing character `offset`, given each page's start offset
 * in the joined text (ascending). Binary search; null when no pages are known.
 */
export function pageAtOffset(pageStarts: number[], offset: number): number | null {
  if (pageStarts.length === 0) return null
  let lo = 0
  let hi = pageStarts.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (pageStarts[mid] <= offset) lo = mid
    else hi = mid - 1
  }
  return lo + 1
}

export interface MarkdownHeading {
  /** Character offset of the heading line in the text. */
  offset: number
  /** Heading text without `#` markers, trimmed and capped at SECTION_LABEL_MAX chars. */
  label: string
}

export const SECTION_LABEL_MAX = 60

/**
 * ATX Markdown headings (`# Title` … `###### Title`) in document order,
 * skipping lines inside fenced code blocks. anydoc emits one `## <sheet name>`
 * per spreadsheet sheet and `#`-headings for Word/ODT heading styles.
 */
export function findMarkdownHeadings(text: string): MarkdownHeading[] {
  const headings: MarkdownHeading[] = []
  let fence: string | null = null
  let offset = 0
  for (const rawLine of text.split("\n")) {
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine
    const fenceMatch = /^ {0,3}(`{3,}|~{3,})/.exec(line)
    if (fenceMatch) {
      const marker = fenceMatch[1]
      if (fence === null) fence = marker
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = null
    } else if (fence === null) {
      const match = /^ {0,3}#{1,6}[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/.exec(line)
      const raw = match?.[1].replace(/\s+/g, " ").trim()
      if (raw) {
        const label = raw.length > SECTION_LABEL_MAX ? `${raw.slice(0, SECTION_LABEL_MAX - 1).trimEnd()}…` : raw
        headings.push({ offset, label })
      }
    }
    offset += rawLine.length + 1
  }
  return headings
}

/** Label of the nearest heading at or before `offset` (binary search); null when none. */
export function sectionAtOffset(headings: MarkdownHeading[], offset: number): string | null {
  let lo = 0
  let hi = headings.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (headings[mid].offset <= offset) {
      found = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return found === -1 ? null : headings[found].label
}

export interface BuildChunksOptions {
  /**
   * Also return `chunkSections`: for each chunk, the nearest Markdown heading
   * at or before where it starts (null when none). Meant for anydoc output.
   */
  sections?: boolean
}

/**
 * Where each chunk starts in `text`, tolerating offset drift from overlap.
 *
 * Default (page tagging, unchanged): the chunk's first line searched from a
 * 2000-char look-back behind the previous chunk, else the recorded startChar.
 *
 * `nearestToRecorded` (section labels): spreadsheets repeat lines — the same
 * header row in every monthly sheet — so "first match in the look-back" can
 * land on the previous sheet's copy. Instead take the occurrence closest to the
 * chunk's recorded startChar (which drifts by tens of characters, not by a
 * sheet), never before the previous chunk; fall back to the default search.
 */
function locateChunkOffsets(text: string, advancedChunks: TextChunk[], nearestToRecorded = false): number[] {
  const WINDOW = 2000
  let searchFrom = 0
  return advancedChunks.map((chunk) => {
    // startChar can drift once overlap is prepended; locate the chunk's own
    // text (its first line) and fall back to the recorded offset.
    const probe = chunk.content.trim().split("\n")[0].slice(0, 80)
    const recorded = chunk.metadata.startChar
    let offset = -1
    if (probe && nearestToRecorded) {
      let pos = text.indexOf(probe, Math.max(searchFrom, recorded - WINDOW))
      while (pos !== -1 && pos <= recorded + WINDOW) {
        if (offset === -1 || Math.abs(pos - recorded) < Math.abs(offset - recorded)) offset = pos
        if (pos >= recorded) break // later occurrences only get farther away
        pos = text.indexOf(probe, pos + 1)
      }
    }
    if (offset === -1 && probe) offset = text.indexOf(probe, Math.max(0, searchFrom - WINDOW))
    if (offset === -1) offset = recorded
    searchFrom = offset
    return offset
  })
}

/**
 * Chunk extracted text, dropping any chunk that is only whitespace.
 *
 * When `pageStarts` (the character offset where each page begins in `text`) is
 * given, every chunk is tagged with the page it starts on (`metadata.page`,
 * `chunkPages`) and the page it ends on (`chunkPageEnds`), aligned
 * index-for-index with `chunks`. Short pages are merged into one chunk, so a
 * chunk can span pages; citing only its start page would point at the wrong one.
 *
 * With `options.sections`, `chunkSections` is returned too, aligned the same
 * way (see BuildChunksOptions); otherwise it is undefined.
 */
export function buildChunks(
  text: string,
  fileName?: string,
  documentId?: string,
  pageStarts?: number[],
  options: BuildChunksOptions = {},
) {
  const advancedChunks = new AdvancedChunker(DEFAULT_CHUNK_OPTIONS)
    .chunkText(text, documentId, fileName)
    .filter((c) => c.content.trim().length > 0)

  const hasPages = !!pageStarts && pageStarts.length > 0
  let chunkPageEnds: Array<number | null> | undefined
  if (pageStarts && hasPages) {
    const offsets = locateChunkOffsets(text, advancedChunks)
    chunkPageEnds = advancedChunks.map((chunk, i) => {
      chunk.metadata.page = pageAtOffset(pageStarts, offsets[i]) ?? undefined
      // End: where the chunk's last line sits in the text (overlap whitespace can
      // differ from the source, so search for the tail rather than add lengths).
      const tail = chunk.content.trim().split("\n").pop()!.slice(-60)
      const tailAt = tail ? text.indexOf(tail, offsets[i]) : -1
      const end = tailAt >= 0 ? tailAt + tail.length - 1 : offsets[i] + chunk.content.length - 1
      return pageAtOffset(pageStarts, Math.max(offsets[i], end))
    })
  }

  let chunkSections: Array<string | null> | undefined
  if (options.sections) {
    const headings = findMarkdownHeadings(text)
    chunkSections = locateChunkOffsets(text, advancedChunks, true).map((offset) => sectionAtOffset(headings, offset))
  }

  const chunks = advancedChunks.map((c) => c.content)
  const chunkPages = hasPages ? advancedChunks.map((c) => c.metadata.page ?? null) : undefined
  return { advancedChunks, chunks, chunkPages, chunkPageEnds, chunkSections }
}

/** Join per-page texts with blank lines, recording where each page starts. */
export function joinPages(pageTexts: string[]): { text: string; pageStarts: number[] } {
  const pageStarts: number[] = []
  let text = ""
  for (const page of pageTexts) {
    if (text) text += "\n\n"
    pageStarts.push(text.length)
    text += page.trim()
  }
  return { text, pageStarts }
}

export type ExtractionQuality = "high" | "medium" | "low" | "none"

/** Shared "how much did we get out of this document" heuristic. */
export function assessExtractionQuality(text: string): ExtractionQuality {
  if (!text) return "none"
  if (text.length > 500) return "high"
  if (text.length > 100) return "medium"
  return "low"
}
