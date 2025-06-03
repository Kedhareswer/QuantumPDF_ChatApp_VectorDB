export interface TextChunk {
  content: string
  metadata: {
    index: number
    startChar: number
    endChar: number
    wordCount: number
    type: "paragraph" | "heading" | "list" | "table" | "other"
    confidence: number
  }
}

export interface ChunkingOptions {
  maxChunkSize: number
  minChunkSize: number
  overlap: number
  preserveStructure: boolean
  semanticSplitting: boolean
}

export class AdvancedChunker {
  private options: ChunkingOptions

  constructor(options: ChunkingOptions) {
    this.options = options
  }

  chunkText(text: string): TextChunk[] {
    if (!text || text.trim().length === 0) {
      return []
    }

    const chunks: TextChunk[] = []
    const paragraphs = this.splitIntoParagraphs(text)

    let currentChunk = ""
    let chunkStartChar = 0
    let chunkIndex = 0

    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length > this.options.maxChunkSize && currentChunk.length > 0) {
        // Create chunk from current content
        chunks.push(this.createChunk(currentChunk, chunkIndex, chunkStartChar))

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
      chunks.push(this.createChunk(currentChunk, chunkIndex, chunkStartChar))
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

  private createChunk(content: string, index: number, startChar: number): TextChunk {
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
}
