'use client';

import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { AdvancedChunker, type TextChunk } from './advanced-chunking';

export interface SpreadsheetProcessingResult {
  text: string;
  chunks: string[];
  advancedChunks?: TextChunk[];
  metadata: {
    title: string;
    sheets: number;
    rows: number;
    columns: number;
    processingMethod: string;
    extractionQuality: 'high' | 'medium' | 'low';
    fileSize: number;
    processingTime: number;
    warnings: string[];
    format: 'xlsx' | 'xls' | 'csv' | 'tsv';
  };
}

export interface ProcessingProgress {
  stage: string;
  progress: number;
  details?: string;
  currentSheet?: number;
  totalSheets?: number;
}

export class SpreadsheetProcessor {
  private chunker: AdvancedChunker;
  private processingAborted = false;

  constructor() {
    this.chunker = new AdvancedChunker({
      maxChunkSize: 1000,
      minChunkSize: 200,
      overlap: 150,
      preserveStructure: true,
      semanticSplitting: true,
      documentAware: true,
      adaptiveThreshold: true,
    });
  }

  async processFile(
    file: File,
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<SpreadsheetProcessingResult> {
    const startTime = Date.now();
    this.processingAborted = false;
    const warnings: string[] = [];

    try {
      this.validateFile(file);

      onProgress?.({
        stage: 'Reading file...',
        progress: 10,
      });

      const format = this.detectFormat(file);

      if (format === 'csv' || format === 'tsv') {
        return await this.processCSV(file, onProgress, startTime, warnings, format);
      } else {
        return await this.processExcel(file, onProgress, startTime, warnings, format);
      }
    } catch (error) {
      console.error('Spreadsheet processing failed:', error);
      const processingTime = Date.now() - startTime;
      const fallbackText = this.createFallbackContent(file, error, processingTime);

      const advancedChunks = this.chunker.chunkText(fallbackText, Date.now().toString(), file.name);
      const chunks = advancedChunks.map((chunk) => chunk.content);

      return {
        text: fallbackText,
        chunks,
        advancedChunks,
        metadata: {
          title: file.name,
          sheets: 0,
          rows: 0,
          columns: 0,
          processingMethod: 'Fallback',
          extractionQuality: 'low',
          fileSize: file.size,
          processingTime,
          warnings: [
            'Spreadsheet processing failed',
            error instanceof Error ? error.message : 'Unknown error',
            ...warnings,
          ],
          format: this.detectFormat(file),
        },
      };
    }
  }

  private validateFile(file: File): void {
    if (!file) {
      throw new Error('No file provided');
    }

    const validTypes = [
      'text/csv',
      'text/tab-separated-values',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.oasis.opendocument.spreadsheet',
    ];

    const validExtensions = ['.csv', '.tsv', '.xls', '.xlsx', '.ods'];
    const hasValidExtension = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));

    if (!validTypes.includes(file.type) && !hasValidExtension) {
      throw new Error('File must be a spreadsheet (CSV, TSV, XLS, XLSX, ODS)');
    }

    if (file.size > 50 * 1024 * 1024) {
      throw new Error('File size exceeds 50MB limit');
    }

    if (file.size === 0) {
      throw new Error('File is empty');
    }
  }

  private detectFormat(file: File): 'xlsx' | 'xls' | 'csv' | 'tsv' {
    const name = file.name.toLowerCase();
    if (name.endsWith('.csv')) return 'csv';
    if (name.endsWith('.tsv')) return 'tsv';
    if (name.endsWith('.xls')) return 'xls';
    if (name.endsWith('.xlsx') || name.endsWith('.ods')) return 'xlsx';
    if (file.type === 'text/csv') return 'csv';
    if (file.type === 'text/tab-separated-values') return 'tsv';
    return 'xlsx';
  }

  private async processCSV(
    file: File,
    onProgress?: (progress: ProcessingProgress) => void,
    startTime: number = Date.now(),
    warnings: string[] = [],
    format: 'csv' | 'tsv' = 'csv'
  ): Promise<SpreadsheetProcessingResult> {
    onProgress?.({
      stage: `Parsing ${format.toUpperCase()} file...`,
      progress: 30,
    });

    const text = await file.text();

    return new Promise((resolve, reject) => {
      Papa.parse(text, {
        delimiter: format === 'tsv' ? '\t' : ',',
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            onProgress?.({
              stage: 'Converting to text format...',
              progress: 60,
            });

            const { formattedText, rowCount, columnCount } = this.formatCSVData(
              results.data as unknown[],
              results.meta.fields || [],
              file.name
            );

            if (results.errors.length > 0) {
              results.errors.forEach((err) => {
                warnings.push(`Row ${err.row}: ${err.message}`);
              });
            }

            onProgress?.({
              stage: 'Creating text chunks...',
              progress: 85,
            });

            const advancedChunks = this.chunker.chunkText(formattedText, Date.now().toString(), file.name);
            const chunks = advancedChunks.map((chunk) => chunk.content);

            const processingTime = Date.now() - startTime;

            resolve({
              text: formattedText,
              chunks,
              advancedChunks,
              metadata: {
                title: file.name,
                sheets: 1,
                rows: rowCount,
                columns: columnCount,
                processingMethod: `Papaparse (${format.toUpperCase()})`,
                extractionQuality: this.determineQuality(rowCount, columnCount, formattedText),
                fileSize: file.size,
                processingTime,
                warnings,
                format,
              },
            });
          } catch (error) {
            reject(error);
          }
        },
        error: (error: Error) => {
          reject(new Error(`CSV parsing failed: ${error.message}`));
        },
      });
    });
  }

  private async processExcel(
    file: File,
    onProgress?: (progress: ProcessingProgress) => void,
    startTime: number = Date.now(),
    warnings: string[] = [],
    format: 'xlsx' | 'xls' = 'xlsx'
  ): Promise<SpreadsheetProcessingResult> {
    onProgress?.({
      stage: 'Reading Excel file...',
      progress: 20,
    });

    const arrayBuffer = await file.arrayBuffer();

    onProgress?.({
      stage: 'Parsing workbook...',
      progress: 40,
    });

    const workbook = XLSX.read(arrayBuffer, {
      type: 'array',
      cellDates: true,
      cellNF: false,
      cellText: false,
    });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('No sheets found in workbook');
    }

    onProgress?.({
      stage: 'Processing sheets...',
      progress: 50,
      totalSheets: workbook.SheetNames.length,
    });

    let fullText = `# Spreadsheet: ${file.name}\n\n`;
    let totalRows = 0;
    let maxColumns = 0;

    for (let i = 0; i < workbook.SheetNames.length && !this.processingAborted; i++) {
      const sheetName = workbook.SheetNames[i];
      const sheet = workbook.Sheets[sheetName];

      onProgress?.({
        stage: `Processing sheet: ${sheetName}`,
        progress: 50 + (i / workbook.SheetNames.length) * 30,
        currentSheet: i + 1,
        totalSheets: workbook.SheetNames.length,
      });

      try {
        const jsonData = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: '',
          blankrows: false,
        }) as unknown[][];

        if (jsonData.length === 0) {
          warnings.push(`Sheet "${sheetName}" is empty`);
          continue;
        }

        const { formattedText, rowCount, columnCount } = this.formatExcelSheet(
          jsonData,
          sheetName,
          workbook.SheetNames.length > 1
        );

        fullText += formattedText + '\n\n';
        totalRows += rowCount;
        maxColumns = Math.max(maxColumns, columnCount);
      } catch (sheetError) {
        const message = sheetError instanceof Error ? sheetError.message : 'Unknown error';
        warnings.push(`Sheet "${sheetName}": ${message}`);
        fullText += `## Sheet: ${sheetName}\n[Error processing sheet: ${message}]\n\n`;
      }
    }

    onProgress?.({
      stage: 'Creating text chunks...',
      progress: 85,
    });

    const advancedChunks = this.chunker.chunkText(fullText.trim(), Date.now().toString(), file.name);
    const chunks = advancedChunks.map((chunk) => chunk.content);

    const processingTime = Date.now() - startTime;

    return {
      text: fullText.trim(),
      chunks,
      advancedChunks,
      metadata: {
        title: file.name,
        sheets: workbook.SheetNames.length,
        rows: totalRows,
        columns: maxColumns,
        processingMethod: `SheetJS (${format.toUpperCase()})`,
        extractionQuality: this.determineQuality(totalRows, maxColumns, fullText),
        fileSize: file.size,
        processingTime,
        warnings,
        format,
      },
    };
  }

  private formatCSVData(
    data: unknown[],
    headers: string[],
    fileName: string
  ): { formattedText: string; rowCount: number; columnCount: number } {
    let text = `# CSV Document: ${fileName}\n\n`;

    if (headers.length > 0) {
      text += `**Columns**: ${headers.join(', ')}\n\n`;
    }

    text += '## Data\n\n';

    // Create a markdown table
    if (data.length > 0 && headers.length > 0) {
      // Header row
      text += '| ' + headers.join(' | ') + ' |\n';
      text += '|' + headers.map(() => '---').join('|') + '|\n';

      // Data rows (limit to first 1000 rows for performance)
      const rowsToProcess = Math.min(data.length, 1000);
      for (let i = 0; i < rowsToProcess; i++) {
        const row = data[i];
        const values = headers.map((header) => {
          const value = row[header];
          return value !== null && value !== undefined ? String(value) : '';
        });
        text += '| ' + values.join(' | ') + ' |\n';
      }

      if (data.length > 1000) {
        text += `\n*Note: Showing first 1000 of ${data.length} rows*\n`;
      }
    }

    // Add summary statistics
    text += `\n## Summary\n`;
    text += `- Total Rows: ${data.length}\n`;
    text += `- Total Columns: ${headers.length}\n`;

    return {
      formattedText: text,
      rowCount: data.length,
      columnCount: headers.length,
    };
  }

  private formatExcelSheet(
    data: unknown[][],
    sheetName: string,
    includeSheetName: boolean
  ): { formattedText: string; rowCount: number; columnCount: number } {
    let text = '';

    if (includeSheetName) {
      text += `## Sheet: ${sheetName}\n\n`;
    }

    if (data.length === 0) {
      return { formattedText: text + '[Empty sheet]\n', rowCount: 0, columnCount: 0 };
    }

    const maxColumns = Math.max(...data.map((row) => row.length));

    // Assume first row is headers
    const headers = data[0].map((cell, idx) => {
      const value = cell !== null && cell !== undefined ? String(cell) : `Column ${idx + 1}`;
      return value;
    });

    // Create markdown table
    text += '| ' + headers.join(' | ') + ' |\n';
    text += '|' + headers.map(() => '---').join('|') + '|\n';

    // Data rows (limit to first 1000 rows)
    const rowsToProcess = Math.min(data.length - 1, 1000);
    for (let i = 1; i <= rowsToProcess; i++) {
      const row = data[i];
      const values = headers.map((_, colIdx) => {
        const value = row[colIdx];
        if (value === null || value === undefined) return '';
        if (value instanceof Date) return value.toISOString().split('T')[0];
        return String(value);
      });
      text += '| ' + values.join(' | ') + ' |\n';
    }

    if (data.length > 1001) {
      text += `\n*Note: Showing first 1000 of ${data.length - 1} data rows*\n`;
    }

    return {
      formattedText: text,
      rowCount: data.length - 1, // Exclude header row
      columnCount: maxColumns,
    };
  }

  private determineQuality(rows: number, columns: number, text: string): 'high' | 'medium' | 'low' {
    if (rows === 0 || columns === 0) return 'low';
    if (rows > 100 && columns > 3 && text.length > 1000) return 'high';
    if (rows > 10 && columns > 1 && text.length > 200) return 'medium';
    return 'low';
  }

  private createFallbackContent(file: File, error: unknown, processingTime: number): string {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return `# Spreadsheet Processing Report: ${file.name}

## Processing Status: FAILED

**Error**: ${errorMessage}
**Processing Time**: ${(processingTime / 1000).toFixed(2)} seconds
**File Size**: ${(file.size / 1024 / 1024).toFixed(2)} MB
**Date**: ${new Date().toLocaleString()}

## What Happened?
The spreadsheet processor encountered an issue while trying to extract data from your file.

### Common Causes:
1. **File Corruption**: The file may be damaged or incomplete
2. **Unsupported Format**: Some legacy or proprietary formats may not be supported
3. **Large File Size**: Very large files may exceed browser memory limits
4. **Complex Formulas**: Files with complex macros or formulas may cause issues
5. **Password Protection**: Encrypted or password-protected files cannot be processed

### Recommended Solutions:
1. **Try a Different File**: Test with a simpler spreadsheet
2. **Export as CSV**: Convert the file to CSV format in Excel/Google Sheets
3. **Remove Formulas**: Copy and paste values only to a new sheet
4. **Split Large Files**: Break large datasets into smaller files

## Next Steps:
You can:
1. Upload a different spreadsheet file
2. Try converting to CSV format
3. Use manual text input

---
*This is an automatically generated fallback document.*`;
  }

  public abort(): void {
    this.processingAborted = true;
  }

  public isProcessing(): boolean {
    return !this.processingAborted;
  }
}

