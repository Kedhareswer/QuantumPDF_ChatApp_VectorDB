'use client';

import type { ExtractedTable } from "@/types/multimodal-types"

export interface TableExtractionOptions {
  maxTables?: number
  minRows?: number
  minColumns?: number
  preserveFormatting?: boolean
  includeHeaders?: boolean
}

export interface TableExtractionResult {
  tables: ExtractedTable[]
  totalFound: number
  extractionTime: number
}

export interface TableExtractionProgress {
  stage: string
  pageNumber?: number
  processed: number
  total: number
}

/**
 * Table Extractor for PDF documents
 * Extracts structured tables from PDF text content
 */
export class PDFTableExtractor {
  private extractedTables: ExtractedTable[] = []
  private tableCounter = 0

  constructor(private readonly defaultOptions: TableExtractionOptions = {}) {}

  /**
   * Extract tables from PDF text content
   * Uses heuristics to detect table-like structures in text
   */
  async extractTablesFromText(
    pdf: any, // PDFDocumentProxy
    documentId: string,
    options: TableExtractionOptions = {},
    onProgress?: (progress: TableExtractionProgress) => void,
  ): Promise<TableExtractionResult> {
    const startTime = Date.now()
    this.extractedTables = []
    this.tableCounter = 0

    const mergedOptions: Required<TableExtractionOptions> = {
      maxTables: options.maxTables ?? this.defaultOptions.maxTables ?? 20,
      minRows: options.minRows ?? this.defaultOptions.minRows ?? 2,
      minColumns: options.minColumns ?? this.defaultOptions.minColumns ?? 2,
      preserveFormatting: options.preserveFormatting ?? this.defaultOptions.preserveFormatting ?? true,
      includeHeaders: options.includeHeaders ?? this.defaultOptions.includeHeaders ?? true,
    }

    const totalPages = pdf.numPages

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      if (this.extractedTables.length >= mergedOptions.maxTables) {
        break
      }

      try {
        onProgress?.({
          stage: "Extracting tables from text",
          pageNumber: pageNum,
          processed: this.extractedTables.length,
          total: totalPages,
        })

        const page = await pdf.getPage(pageNum)
        const textContent = await page.getTextContent()
        
        const tables = await this.detectTablesInText(
          textContent,
          pageNum,
          documentId,
          mergedOptions,
        )

        this.extractedTables.push(...tables)
      } catch (error) {
        console.error(`Error extracting tables from page ${pageNum}:`, error)
      }
    }

    const extractionTime = Date.now() - startTime

    onProgress?.({
      stage: "Completed table extraction",
      processed: this.extractedTables.length,
      total: totalPages,
    })

    return {
      tables: this.extractedTables,
      totalFound: this.extractedTables.length,
      extractionTime,
    }
  }

  /**
   * Detect tables in text content using heuristics
   */
  private async detectTablesInText(
    textContent: any,
    pageNumber: number,
    documentId: string,
    options: Required<TableExtractionOptions>,
  ): Promise<ExtractedTable[]> {
    const tables: ExtractedTable[] = []

    // Group text items by vertical position (y-coordinate)
    const lines = this.groupTextItemsByLine(textContent.items)

    // Look for table-like patterns
    const tableRegions = this.findTableRegions(lines, options)

    for (const region of tableRegions) {
      try {
        const table = this.parseTableRegion(
          region,
          pageNumber,
          documentId,
          options,
        )

        if (table) {
          tables.push(table)
        }
      } catch (error) {
        console.warn('Failed to parse table region:', error)
      }
    }

    return tables
  }

  /**
   * Group text items by line (similar y-coordinates)
   */
  private groupTextItemsByLine(items: any[]): any[][] {
    const lines: Map<number, any[]> = new Map()
    const yTolerance = 2 // pixels

    for (const item of items) {
      const y = Math.round(item.transform[5] / yTolerance) * yTolerance
      
      if (!lines.has(y)) {
        lines.set(y, [])
      }
      
      lines.get(y)!.push(item)
    }

    // Sort items within each line by x-coordinate
    for (const [, lineItems] of lines) {
      lineItems.sort((a, b) => a.transform[4] - b.transform[4])
    }

    // Convert to array and sort by y-coordinate (descending - PDF coords are bottom-up)
    return Array.from(lines.values()).sort((a, b) => 
      b[0].transform[5] - a[0].transform[5]
    )
  }

  /**
   * Find regions that look like tables
   */
  private findTableRegions(
    lines: any[][],
    options: Required<TableExtractionOptions>,
  ): any[][] {
    const regions: any[][] = []
    let currentRegion: any[] = []
    let prevColumnCount = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const columnCount = this.estimateColumnCount(line)

      // Check if this line looks like part of a table
      if (columnCount >= options.minColumns) {
        // Check if column count is consistent with previous line
        if (prevColumnCount === 0 || Math.abs(columnCount - prevColumnCount) <= 1) {
          currentRegion.push(line)
          prevColumnCount = columnCount
        } else {
          // Column count changed significantly - new table or end of table
          if (currentRegion.length >= options.minRows) {
            regions.push([...currentRegion])
          }
          currentRegion = [line]
          prevColumnCount = columnCount
        }
      } else {
        // Not a table line - save current region if valid
        if (currentRegion.length >= options.minRows) {
          regions.push([...currentRegion])
        }
        currentRegion = []
        prevColumnCount = 0
      }
    }

    // Don't forget the last region
    if (currentRegion.length >= options.minRows) {
      regions.push(currentRegion)
    }

    return regions
  }

  /**
   * Estimate number of columns based on text spacing
   */
  private estimateColumnCount(line: any[]): number {
    if (line.length <= 1) return line.length

    // Calculate gaps between text items
    const gaps: number[] = []
    for (let i = 1; i < line.length; i++) {
      const prevItem = line[i - 1]
      const currItem = line[i]
      const gap = currItem.transform[4] - (prevItem.transform[4] + prevItem.width)
      gaps.push(gap)
    }

    // Large gaps indicate column boundaries
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length
    const largeGaps = gaps.filter(g => g > avgGap * 1.5).length

    return largeGaps + 1
  }

  /**
   * Parse a detected table region into structured data
   */
  private parseTableRegion(
    region: any[][],
    pageNumber: number,
    documentId: string,
    options: Required<TableExtractionOptions>,
  ): ExtractedTable | null {
    if (region.length < options.minRows) {
      return null
    }

    // Determine column boundaries by analyzing x-positions across all rows
    const columnBoundaries = this.determineColumnBoundaries(region)

    if (columnBoundaries.length - 1 < options.minColumns) {
      return null
    }

    // Extract cell data
    const rows: string[][] = []
    let headers: string[] | undefined

    for (let i = 0; i < region.length; i++) {
      const line = region[i]
      const row: string[] = []

      // Extract text for each column
      for (let col = 0; col < columnBoundaries.length - 1; col++) {
        const leftBound = columnBoundaries[col]
        const rightBound = columnBoundaries[col + 1]

        const cellText = line
          .filter(item => {
            const x = item.transform[4]
            return x >= leftBound && x < rightBound
          })
          .map(item => item.str)
          .join(' ')
          .trim()

        row.push(cellText)
      }

      // First row might be headers
      if (i === 0 && options.includeHeaders && this.looksLikeHeader(row)) {
        headers = row
      } else {
        rows.push(row)
      }
    }

    // Generate table metadata
    const tableId = `${documentId}_table_${pageNumber}_${++this.tableCounter}`
    
    // Calculate bounding box
    const firstLine = region[0]
    const lastLine = region[region.length - 1]
    const minX = Math.min(...region.flat().map(item => item.transform[4]))
    const maxX = Math.max(...region.flat().map(item => item.transform[4] + item.width))
    const minY = Math.min(...region.flat().map(item => item.transform[5]))
    const maxY = Math.max(...region.flat().map(item => item.transform[5] + item.height))

    const table: ExtractedTable = {
      id: tableId,
      documentId,
      pageNumber,
      position: {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      },
      headers,
      rows,
      rowCount: rows.length,
      columnCount: columnBoundaries.length - 1,
      caption: `Table from page ${pageNumber}`,
      confidence: this.calculateTableConfidence(region, rows),
      extractedAt: new Date(),
    }

    return table
  }

  /**
   * Determine column boundaries across all rows
   */
  private determineColumnBoundaries(region: any[][]): number[] {
    const allXPositions: number[] = []

    // Collect all x-positions
    for (const line of region) {
      for (const item of line) {
        allXPositions.push(item.transform[4])
      }
    }

    if (allXPositions.length === 0) return []

    // Sort positions
    allXPositions.sort((a, b) => a - b)

    // Cluster nearby positions
    const boundaries: number[] = [allXPositions[0]]
    const clusterTolerance = 10 // pixels

    for (let i = 1; i < allXPositions.length; i++) {
      const x = allXPositions[i]
      const lastBoundary = boundaries[boundaries.length - 1]

      if (x - lastBoundary > clusterTolerance) {
        boundaries.push(x)
      }
    }

    // Add right boundary
    const maxX = Math.max(...allXPositions) + 100
    boundaries.push(maxX)

    return boundaries
  }

  /**
   * Check if a row looks like a header
   */
  private looksLikeHeader(row: string[]): boolean {
    // Headers typically have shorter text and may contain colons or all caps
    const avgLength = row.reduce((sum, cell) => sum + cell.length, 0) / row.length
    const hasColons = row.some(cell => cell.includes(':'))
    const allCaps = row.every(cell => cell === cell.toUpperCase() && cell.length > 0)

    return avgLength < 30 || hasColons || allCaps
  }

  /**
   * Calculate confidence score for table extraction
   */
  private calculateTableConfidence(region: any[][], rows: string[][]): number {
    let score = 0.5 // Base score

    // More rows = higher confidence
    if (rows.length >= 5) score += 0.2
    else if (rows.length >= 3) score += 0.1

    // Consistent row lengths = higher confidence
    const rowLengths = rows.map(r => r.length)
    const uniqueLengths = new Set(rowLengths).size
    if (uniqueLengths === 1) score += 0.2
    else if (uniqueLengths <= 2) score += 0.1

    // More data = higher confidence
    const totalCells = rows.flat().filter(cell => cell.length > 0).length
    if (totalCells >= 20) score += 0.1

    return Math.min(score, 1.0)
  }
}

/**
 * Table Extractor for DOCX documents
 * Extracts tables from Word documents
 */
export class DOCXTableExtractor {
  /**
   * Extract tables from DOCX document
   * Note: Mammoth.js doesn't provide direct table access
   * This is a placeholder for future implementation with docx.js
   */
  async extractFromDocument(
    arrayBuffer: ArrayBuffer,
    documentId: string,
    options: TableExtractionOptions = {},
  ): Promise<TableExtractionResult> {
    const startTime = Date.now()

    // Placeholder implementation
    // Full implementation would:
    // 1. Parse DOCX XML structure
    // 2. Find <w:tbl> elements
    // 3. Extract <w:tr> (rows) and <w:tc> (cells)
    // 4. Build ExtractedTable objects

    console.log('DOCX table extraction - implementation pending (requires docx.js)')

    return {
      tables: [],
      totalFound: 0,
      extractionTime: Date.now() - startTime,
    }
  }
}

