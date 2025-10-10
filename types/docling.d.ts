// Docling TypeScript Type Definitions
// Minimal types for ingesting Docling JSON/Markdown outputs

export interface DoclingBoundingBox {
  l: number // left
  t: number // top
  r: number // right
  b: number // bottom
  coord_origin?: string
}

export interface DoclingTextBlock {
  type: 'heading' | 'paragraph' | 'list' | 'table' | 'caption' | 'footer' | 'header' | 'figure' | 'formula' | 'code' | 'other'
  text: string
  level?: number // for headings
  page?: number
  bbox?: DoclingBoundingBox
  confidence?: number
  metadata?: Record<string, any>
}

export interface DoclingTable {
  type: 'table'
  rows: string[][]
  headers?: string[]
  page?: number
  bbox?: DoclingBoundingBox
  caption?: string
}

export interface DoclingDocument {
  metadata?: {
    title?: string
    author?: string
    creationDate?: string
    modificationDate?: string
    pages?: number
    language?: string
  }
  blocks: DoclingTextBlock[]
  tables?: DoclingTable[]
}

export interface DoclingMarkdownExport {
  markdown: string
  metadata?: {
    title?: string
    pages?: number
  }
}
