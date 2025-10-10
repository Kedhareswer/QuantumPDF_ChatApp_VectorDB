// Docling Adapter - Convert Docling JSON/Markdown outputs to TextChunk format
import type { TextChunk } from './advanced-chunking'
import type { DoclingDocument, DoclingMarkdownExport, DoclingTextBlock } from '@/types/docling'
import { AdvancedChunker } from './advanced-chunking'

export interface DoclingIngestResult {
  chunks: TextChunk[]
  docMeta: {
    title?: string
    author?: string
    pages?: number
    language?: string
  }
}

/**
 * Ingest Docling JSON output and convert to TextChunk format
 * Preserves structure, page numbers, and bounding boxes in metadata
 */
export function ingestDoclingJson(
  json: unknown,
  documentId?: string,
  documentName?: string
): DoclingIngestResult {
  // Validate and parse JSON
  if (!json || typeof json !== 'object') {
    throw new Error('Invalid Docling JSON: must be an object')
  }

  const doc = json as DoclingDocument

  if (!doc.blocks || !Array.isArray(doc.blocks)) {
    throw new Error('Invalid Docling JSON: missing or invalid blocks array')
  }

  const chunks: TextChunk[] = []
  let charOffset = 0

  // Process each block
  doc.blocks.forEach((block, index) => {
    if (!block.text || block.text.trim().length === 0) {
      return // Skip empty blocks
    }

    const content = block.text.trim()
    const startChar = charOffset
    const endChar = startChar + content.length
    charOffset = endChar + 2 // +2 for paragraph spacing

    // Map Docling block type to our type system
    const chunkType = mapDoclingTypeToChunkType(block.type)

    // Calculate semantic importance based on block type and content
    const semanticImportance = calculateImportance(block, content)

    // Create chunk with Docling metadata
    const chunk: TextChunk = {
      content,
      metadata: {
        index,
        startChar,
        endChar,
        wordCount: content.split(/\s+/).length,
        type: chunkType,
        confidence: block.confidence || 90,
        documentId,
        documentName,
        semanticImportance,
        keywordDensity: calculateKeywordDensity(content),
        // Add Docling-specific metadata
        ...((block.page !== undefined) && { page: block.page }),
        ...((block.bbox !== undefined) && { bbox: block.bbox }),
        ...((block.level !== undefined) && { level: block.level }),
      },
    }

    chunks.push(chunk)
  })

  // Extract document metadata
  const docMeta = {
    title: doc.metadata?.title,
    author: doc.metadata?.author,
    pages: doc.metadata?.pages,
    language: doc.metadata?.language,
  }

  return { chunks, docMeta }
}

/**
 * Ingest Docling Markdown output and convert to TextChunk format
 * Uses advanced chunking to create semantic chunks with adaptive sizing
 */
export function ingestDoclingMarkdown(
  markdown: string,
  documentId?: string,
  documentName?: string
): DoclingIngestResult {
  if (!markdown || markdown.trim().length === 0) {
    throw new Error('Invalid Docling Markdown: empty or undefined')
  }

  // Use advanced chunker with semantic splitting enabled
  const chunker = new AdvancedChunker({
    maxChunkSize: 1500,
    minChunkSize: 200,
    overlap: 200,
    preserveStructure: true,
    semanticSplitting: true,
    documentAware: true,
    adaptiveThreshold: true,
  })

  const chunks = chunker.chunkText(markdown, documentId, documentName)

  // Extract metadata from markdown (if present in frontmatter)
  const docMeta = extractMarkdownMetadata(markdown)

  return { chunks, docMeta }
}

/**
 * Map Docling block types to our chunk type system
 */
function mapDoclingTypeToChunkType(
  doclingType: DoclingTextBlock['type']
): TextChunk['metadata']['type'] {
  const typeMap: Record<DoclingTextBlock['type'], TextChunk['metadata']['type']> = {
    heading: 'heading',
    paragraph: 'paragraph',
    list: 'list',
    table: 'table',
    caption: 'paragraph',
    footer: 'other',
    header: 'other',
    figure: 'other',
    formula: 'other',
    code: 'other',
    other: 'other',
  }

  return typeMap[doclingType] || 'other'
}

/**
 * Calculate semantic importance based on Docling block metadata
 */
function calculateImportance(block: DoclingTextBlock, content: string): number {
  let importance = 50

  // Boost for headings (especially higher-level headings)
  if (block.type === 'heading') {
    const level = block.level || 1
    importance += Math.max(40 - (level * 5), 10) // h1=40, h2=35, h3=30, etc.
  }

  // Boost for tables (structured data)
  if (block.type === 'table') {
    importance += 25
  }

  // Boost for captions (usually important context)
  if (block.type === 'caption') {
    importance += 20
  }

  // Boost for high-confidence blocks
  if (block.confidence && block.confidence > 90) {
    importance += 10
  }

  // Boost for content with numbers, dates, specific terms
  if (/\d{4}|\d+%|\$\d+/.test(content)) {
    importance += 10
  }
  if (/\b(important|key|critical|significant|main|primary|conclusion|summary)\b/i.test(content)) {
    importance += 15
  }

  // Boost for content with proper nouns
  const properNouns = (content.match(/\b[A-Z][a-z]+\b/g) || []).length
  importance += Math.min(properNouns * 2, 20)

  return Math.min(100, importance)
}

/**
 * Calculate keyword density for a text chunk
 */
function calculateKeywordDensity(content: string): number {
  const words = content.toLowerCase().split(/\s+/)
  const uniqueWords = new Set(words)
  return (uniqueWords.size / words.length) * 100
}

/**
 * Extract metadata from markdown frontmatter (if present)
 */
function extractMarkdownMetadata(markdown: string): DoclingIngestResult['docMeta'] {
  const docMeta: DoclingIngestResult['docMeta'] = {}

  // Check for YAML frontmatter
  const frontmatterMatch = markdown.match(/^---\n([\s\S]*?)\n---/)
  if (frontmatterMatch) {
    const frontmatter = frontmatterMatch[1]

    // Extract title
    const titleMatch = frontmatter.match(/title:\s*(.+)/)
    if (titleMatch) {
      docMeta.title = titleMatch[1].trim().replace(/['"]/g, '')
    }

    // Extract author
    const authorMatch = frontmatter.match(/author:\s*(.+)/)
    if (authorMatch) {
      docMeta.author = authorMatch[1].trim().replace(/['"]/g, '')
    }

    // Extract pages
    const pagesMatch = frontmatter.match(/pages:\s*(\d+)/)
    if (pagesMatch) {
      docMeta.pages = parseInt(pagesMatch[1])
    }
  }

  return docMeta
}
