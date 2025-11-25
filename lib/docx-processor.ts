'use client';

import mammoth from 'mammoth';
import { AdvancedChunker, type TextChunk } from './advanced-chunking';
import { DOCXImageExtractor } from './image-extractor';
import type { MultimodalMetadata } from '@/types/multimodal-types';

export interface DOCXProcessingResult {
  text: string;
  chunks: string[];
  advancedChunks?: TextChunk[];
  metadata: {
    documentType: "docx";
    title: string;
    processingMethod: string;
    extractionQuality: 'high' | 'medium' | 'low';
    fileSize: number;
    processingTime: number;
    warnings: string[];
    wordCount: number;
    paragraphCount: number;
    hasImages: boolean;
    multimodal?: MultimodalMetadata;
  };
}

export interface ProcessingProgress {
  stage: string;
  progress: number;
  details?: string;
}

export class DOCXProcessor {
  private chunker: AdvancedChunker;
  private processingAborted = false;
  private imageExtractor: DOCXImageExtractor;

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
    this.imageExtractor = new DOCXImageExtractor();
  }

  async processFile(
    file: File,
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<DOCXProcessingResult> {
    const startTime = Date.now();
    this.processingAborted = false;
    const warnings: string[] = [];

    try {
      this.validateFile(file);

      onProgress?.({
        stage: 'Reading DOCX file...',
        progress: 10,
      });

      const arrayBuffer = await file.arrayBuffer();

      onProgress?.({
        stage: 'Extracting text content...',
        progress: 30,
      });

      const result = await mammoth.extractRawText({ arrayBuffer });

      if (result.messages && result.messages.length > 0) {
        result.messages.forEach((msg) => {
          if (msg.type === 'warning' || msg.type === 'error') {
            warnings.push(`${msg.type}: ${msg.message}`);
          }
        });
      }

      const extractedText = result.value;

      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error('No text content could be extracted from the DOCX file');
      }

      onProgress?.({
        stage: 'Analyzing document structure...',
        progress: 60,
      });

      const wordCount = extractedText.split(/\s+/).filter((word) => word.length > 0).length;
      const paragraphCount = extractedText.split(/\n\n+/).filter((para) => para.trim().length > 0).length;

      // Format the text with proper structure
      const formattedText = this.formatDocumentText(extractedText, file.name);

      onProgress?.({
        stage: 'Creating text chunks...',
        progress: 85,
      });

      const advancedChunks = this.chunker.chunkText(formattedText, Date.now().toString(), file.name);
      const chunks = advancedChunks.map((chunk) => chunk.content);

      onProgress?.({
        stage: 'Extracting embedded images...',
        progress: 90,
      });

      // Extract images from DOCX
      const documentId = `${file.name}-${startTime}`;
      const imageExtraction = await this.imageExtractor.extractFromDocument(arrayBuffer, documentId, {
        maxImages: 30,
        minWidth: 32,
        minHeight: 32,
      });

      const multimodal: MultimodalMetadata | undefined = imageExtraction.totalFound > 0 ? {
        images: imageExtraction.images,
        tables: [],
        equations: [],
        charts: [],
        summary: {
          imageCount: imageExtraction.images.length,
          tableCount: 0,
          equationCount: 0,
          chartCount: 0,
        },
      } : undefined;

      const processingTime = Date.now() - startTime;

      return {
        text: formattedText,
        chunks,
        advancedChunks,
        metadata: {
          documentType: "docx",
          title: file.name,
          processingMethod: 'Mammoth.js (DOCX)',
          extractionQuality: this.determineQuality(wordCount, extractedText, warnings),
          fileSize: file.size,
          processingTime,
          warnings,
          wordCount,
          paragraphCount,
          hasImages: result.messages.some((msg) => msg.message.includes('image')) || imageExtraction.totalFound > 0,
          multimodal,
        },
      };
    } catch (error) {
      console.error('DOCX processing failed:', error);
      const processingTime = Date.now() - startTime;
      const fallbackText = this.createFallbackContent(file, error, processingTime);

      const advancedChunks = this.chunker.chunkText(fallbackText, Date.now().toString(), file.name);
      const chunks = advancedChunks.map((chunk) => chunk.content);

      return {
        text: fallbackText,
        chunks,
        advancedChunks,
        metadata: {
          documentType: "docx",
          title: file.name,
          processingMethod: 'Fallback',
          extractionQuality: 'low',
          fileSize: file.size,
          processingTime,
          warnings: [
            'DOCX processing failed',
            error instanceof Error ? error.message : 'Unknown error',
            ...warnings,
          ],
          wordCount: 0,
          paragraphCount: 0,
          hasImages: false,
        },
      };
    }
  }

  private validateFile(file: File): void {
    if (!file) {
      throw new Error('No file provided');
    }

    const validTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];

    const validExtensions = ['.docx', '.doc'];
    const hasValidExtension = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));

    if (!validTypes.includes(file.type) && !hasValidExtension) {
      throw new Error('File must be a Word document (DOCX or DOC)');
    }

    if (file.size > 50 * 1024 * 1024) {
      throw new Error('File size exceeds 50MB limit');
    }

    if (file.size === 0) {
      throw new Error('File is empty');
    }
  }

  private formatDocumentText(text: string, fileName: string): string {
    // Clean up the text
    let formatted = text
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\n{3,}/g, '\n\n') // Remove excessive line breaks
      .trim();

    // Add document header
    const header = `# Document: ${fileName}\n\n`;

    return header + formatted;
  }

  private determineQuality(
    wordCount: number,
    text: string,
    warnings: string[]
  ): 'high' | 'medium' | 'low' {
    if (warnings.length > 10) return 'low';
    if (wordCount === 0 || text.length < 100) return 'low';
    if (wordCount > 500 && text.length > 2000 && warnings.length === 0) return 'high';
    if (wordCount > 100 && text.length > 500) return 'medium';
    return 'low';
  }

  private createFallbackContent(file: File, error: any, processingTime: number): string {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return `# DOCX Processing Report: ${file.name}

## Processing Status: FAILED

**Error**: ${errorMessage}
**Processing Time**: ${(processingTime / 1000).toFixed(2)} seconds
**File Size**: ${(file.size / 1024 / 1024).toFixed(2)} MB
**Date**: ${new Date().toLocaleString()}

## What Happened?
The DOCX processor encountered an issue while trying to extract text from your document.

### Common Causes:
1. **File Corruption**: The file may be damaged or incomplete
2. **Unsupported Format**: Legacy DOC files may have limited support
3. **Complex Formatting**: Documents with heavy formatting, macros, or embedded objects
4. **Password Protection**: Encrypted or password-protected files cannot be processed
5. **Browser Compatibility**: Some browsers have limitations with file processing

### Recommended Solutions:
1. **Try a Different File**: Test with a simpler Word document
2. **Save as DOCX**: If using an old DOC file, re-save as DOCX in Word
3. **Remove Complex Elements**: Simplify formatting, remove macros and embedded objects
4. **Copy Text**: Copy the text content and paste into a new document

## Next Steps:
You can:
1. Upload a different Word document
2. Try converting to PDF format
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

