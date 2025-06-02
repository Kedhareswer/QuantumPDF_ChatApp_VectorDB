// Advanced text chunking algorithm with semantic awareness

export interface ChunkingOptions {
  maxChunkSize: number
  minChunkSize: number
  overlap: number
  preserveStructure: boolean
  semanticSplitting: boolean
  respectSentences: boolean
  respectParagraphs: boolean
}

export interface TextChunk {
  content: string
  index: number
  startPosition: number
  endPosition: number
  type: "paragraph" | "section" | "sentence" | "fragment"
  metadata: {
    wordCount: number
    sentenceCount: number
    hasHeading: boolean
    headingLevel?: number
    topics?: string[]
  }
}

export class AdvancedChunker {
  private defaultOptions: ChunkingOptions = {
    maxChunkSize: 800,
    minChunkSize: 200,
    overlap: 100,
    preserveStructure: true,
    semanticSplitting: true,
    respectSentences: true,
    respectParagraphs: true,
  }

  constructor(private options: Partial<ChunkingOptions> = {}) {
    this.options = { ...this.defaultOptions, ...options }
  }

  chunkText(text: string, customOptions?: Partial<ChunkingOptions>): TextChunk[] {
    const opts = { ...this.options, ...customOptions }

    if (!text || text.trim().length === 0) {
      return []
    }

    console.log(`Advanced chunking with options:`, opts)

    // Preprocess text
    const processedText = this.preprocessText(text)

    // Detect document structure
    const structure = this.analyzeDocumentStructure(processedText)

    // Apply chunking strategy based on structure
    if (opts.preserveStructure && structure.hasStructure) {
      return this.structureAwareChunking(processedText, structure, opts)
    } else if (opts.semanticSplitting) {
      return this.semanticChunking(processedText, opts)
    } else {
      return this.basicChunking(processedText, opts)
    }
  }

  private preprocessText(text: string): string {
    return (
      text
        // Normalize whitespace
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        // Fix common OCR errors
        .replace(/([a-z])([A-Z])/g, "$1 $2") // Add space between lowercase and uppercase
        .replace(/(\w)([.!?])([A-Z])/g, "$1$2 $3") // Add space after punctuation
        // Normalize multiple spaces
        .replace(/[ \t]+/g, " ")
        // Normalize multiple newlines but preserve paragraph breaks
        .replace(/\n{3,}/g, "\n\n")
        .trim()
    )
  }

  private analyzeDocumentStructure(text: string): {
    hasStructure: boolean
    headings: Array<{ text: string; level: number; position: number }>
    paragraphs: Array<{ start: number; end: number }>
    sections: Array<{ start: number; end: number; heading?: string }>
  } {
    const headings: Array<{ text: string; level: number; position: number }> = []
    const paragraphs: Array<{ start: number; end: number }> = []
    const sections: Array<{ start: number; end: number; heading?: string }> = []

    // Detect headings (markdown-style and formatted)
    const lines = text.split("\n")
    let currentPosition = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()

      // Markdown headings
      const mdHeadingMatch = line.match(/^(#{1,6})\s+(.+)$/)
      if (mdHeadingMatch) {
        headings.push({
          text: mdHeadingMatch[2],
          level: mdHeadingMatch[1].length,
          position: currentPosition,
        })
      }

      // Formatted headings (all caps, short lines)
      else if (line.length > 0 && line.length < 80 && line === line.toUpperCase() && /^[A-Z0-9\s\-_:]+$/.test(line)) {
        headings.push({
          text: line,
          level: 1,
          position: currentPosition,
        })
      }

      // Numbered sections
      else if (/^\d+\.?\s+[A-Z]/.test(line) && line.length < 100) {
        headings.push({
          text: line,
          level: 2,
          position: currentPosition,
        })
      }

      currentPosition += line.length + 1 // +1 for newline
    }

    // Detect paragraphs
    const paragraphRegex = /\n\s*\n/g
    let lastEnd = 0
    let match

    while ((match = paragraphRegex.exec(text)) !== null) {
      if (match.index > lastEnd) {
        paragraphs.push({ start: lastEnd, end: match.index })
      }
      lastEnd = match.index + match[0].length
    }

    if (lastEnd < text.length) {
      paragraphs.push({ start: lastEnd, end: text.length })
    }

    // Create sections based on headings
    for (let i = 0; i < headings.length; i++) {
      const start = headings[i].position
      const end = i < headings.length - 1 ? headings[i + 1].position : text.length
      sections.push({
        start,
        end,
        heading: headings[i].text,
      })
    }

    return {
      hasStructure: headings.length > 0 || paragraphs.length > 3,
      headings,
      paragraphs,
      sections,
    }
  }

  private structureAwareChunking(text: string, structure: any, opts: ChunkingOptions): TextChunk[] {
    const chunks: TextChunk[] = []

    if (structure.sections.length > 0) {
      // Chunk by sections
      structure.sections.forEach((section: any, index: number) => {
        const sectionText = text.slice(section.start, section.end).trim()
        if (sectionText.length > opts.maxChunkSize) {
          // Section too large, split further
          const subChunks = this.semanticChunking(sectionText, opts)
          subChunks.forEach((chunk) => {
            chunks.push({
              ...chunk,
              index: chunks.length,
              startPosition: section.start + chunk.startPosition,
              endPosition: section.start + chunk.endPosition,
              metadata: {
                ...chunk.metadata,
                hasHeading: !!section.heading,
                headingLevel: 1,
              },
            })
          })
        } else if (sectionText.length >= opts.minChunkSize) {
          chunks.push(
            this.createChunk(sectionText, chunks.length, section.start, section.end, "section", {
              hasHeading: !!section.heading,
              headingLevel: 1,
            }),
          )
        }
      })
    } else {
      // Chunk by paragraphs
      structure.paragraphs.forEach((para: any) => {
        const paraText = text.slice(para.start, para.end).trim()
        if (paraText.length >= opts.minChunkSize) {
          if (paraText.length > opts.maxChunkSize) {
            const subChunks = this.semanticChunking(paraText, opts)
            subChunks.forEach((chunk) => {
              chunks.push({
                ...chunk,
                index: chunks.length,
                startPosition: para.start + chunk.startPosition,
                endPosition: para.start + chunk.endPosition,
              })
            })
          } else {
            chunks.push(this.createChunk(paraText, chunks.length, para.start, para.end, "paragraph"))
          }
        }
      })
    }

    return this.addOverlapToChunks(chunks, text, opts.overlap)
  }

  private semanticChunking(text: string, opts: ChunkingOptions): TextChunk[] {
    const chunks: TextChunk[] = []

    // Split by sentences first
    const sentences = this.splitIntoSentences(text)
    let currentChunk = ""
    let currentStart = 0
    let sentenceStart = 0

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i]
      const potentialChunk = currentChunk + (currentChunk ? " " : "") + sentence

      if (potentialChunk.length <= opts.maxChunkSize) {
        if (!currentChunk) {
          currentStart = sentenceStart
        }
        currentChunk = potentialChunk
      } else {
        // Current chunk is full, save it
        if (currentChunk && currentChunk.length >= opts.minChunkSize) {
          chunks.push(
            this.createChunk(currentChunk, chunks.length, currentStart, currentStart + currentChunk.length, "sentence"),
          )
        }

        // Start new chunk
        currentChunk = sentence
        currentStart = sentenceStart
      }

      sentenceStart += sentence.length + 1
    }

    // Add final chunk
    if (currentChunk && currentChunk.length >= opts.minChunkSize) {
      chunks.push(
        this.createChunk(currentChunk, chunks.length, currentStart, currentStart + currentChunk.length, "sentence"),
      )
    }

    return this.addOverlapToChunks(chunks, text, opts.overlap)
  }

  private basicChunking(text: string, opts: ChunkingOptions): TextChunk[] {
    const chunks: TextChunk[] = []
    const words = text.split(/\s+/)
    let currentChunk = ""
    let currentStart = 0
    let wordStart = 0

    for (let i = 0; i < words.length; i++) {
      const word = words[i]
      const potentialChunk = currentChunk + (currentChunk ? " " : "") + word

      if (potentialChunk.length <= opts.maxChunkSize) {
        if (!currentChunk) {
          currentStart = wordStart
        }
        currentChunk = potentialChunk
      } else {
        if (currentChunk && currentChunk.length >= opts.minChunkSize) {
          chunks.push(
            this.createChunk(currentChunk, chunks.length, currentStart, currentStart + currentChunk.length, "fragment"),
          )
        }

        currentChunk = word
        currentStart = wordStart
      }

      wordStart += word.length + 1
    }

    if (currentChunk && currentChunk.length >= opts.minChunkSize) {
      chunks.push(
        this.createChunk(currentChunk, chunks.length, currentStart, currentStart + currentChunk.length, "fragment"),
      )
    }

    return this.addOverlapToChunks(chunks, text, opts.overlap)
  }

  private splitIntoSentences(text: string): string[] {
    // Enhanced sentence splitting that handles common abbreviations
    const abbreviations = new Set([
      "Dr",
      "Mr",
      "Mrs",
      "Ms",
      "Prof",
      "Inc",
      "Ltd",
      "Corp",
      "Co",
      "vs",
      "etc",
      "i.e",
      "e.g",
      "cf",
      "al",
      "St",
      "Ave",
      "Blvd",
    ])

    return text
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
      .filter((sentence) => sentence.trim().length > 0)
      .map((sentence) => sentence.trim())
  }

  private createChunk(
    content: string,
    index: number,
    start: number,
    end: number,
    type: TextChunk["type"],
    additionalMetadata: Partial<TextChunk["metadata"]> = {},
  ): TextChunk {
    const words = content.split(/\s+/).filter((w) => w.length > 0)
    const sentences = this.splitIntoSentences(content)

    return {
      content: content.trim(),
      index,
      startPosition: start,
      endPosition: end,
      type,
      metadata: {
        wordCount: words.length,
        sentenceCount: sentences.length,
        hasHeading: false,
        ...additionalMetadata,
      },
    }
  }

  private addOverlapToChunks(chunks: TextChunk[], originalText: string, overlapSize: number): TextChunk[] {
    if (overlapSize <= 0 || chunks.length <= 1) {
      return chunks
    }

    const overlappedChunks: TextChunk[] = []

    for (let i = 0; i < chunks.length; i++) {
      let chunkContent = chunks[i].content

      // Add overlap from previous chunk
      if (i > 0 && overlapSize > 0) {
        const prevChunk = chunks[i - 1]
        const prevWords = prevChunk.content.split(/\s+/)
        const overlapWords = Math.min(Math.floor(overlapSize / 6), prevWords.length)
        const overlap = prevWords.slice(-overlapWords).join(" ")
        chunkContent = overlap + " " + chunkContent
      }

      overlappedChunks.push({
        ...chunks[i],
        content: chunkContent,
        index: i,
      })
    }

    return overlappedChunks
  }

  // Utility method to get simple chunks (backward compatibility)
  static createSimpleChunks(text: string, chunkSize = 800, overlap = 100): string[] {
    const chunker = new AdvancedChunker({
      maxChunkSize: chunkSize,
      overlap,
      preserveStructure: false,
      semanticSplitting: true,
    })

    return chunker.chunkText(text).map((chunk) => chunk.content)
  }
}
