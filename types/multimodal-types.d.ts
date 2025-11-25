/**
 * Multimodal Document Processing Types
 * Defines types for images, tables, equations, and other visual elements
 */

export type MultimodalImageType =
  | "inline-image"
  | "page-preview"
  | "chart"
  | "figure"
  | "diagram";

export interface ExtractedImage {
  id: string;
  documentId: string;
  pageNumber?: number;
  position?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  dataUrl: string; // Base64 data URL
  mimeType: string;
  width: number;
  height: number;
  caption?: string;
  altText?: string;
  confidence?: number;
  type?: MultimodalImageType;
  source?: "pdf" | "docx" | "spreadsheet" | "html" | "ocr";
  extractedAt: Date;
  analysis?: ImageAnalysisResult;
}

export interface ExtractedTable {
  id: string;
  documentId: string;
  pageNumber?: number;
  position?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  rows?: string[][];
  markdown?: string;
  json?: any[][];
  rowCount: number;
  columnCount: number;
  headers?: string[];
  dataTypes?: string[];
  caption?: string;
  confidence?: number;
  extractedAt: Date;
}

export interface ExtractedEquation {
  id: string;
  documentId: string;
  pageNumber?: number;
  position?: {
    x: number;
    y: number;
  };
  latex?: string;
  mathml?: string;
  ascii?: string;
  description?: string;
  isInline: boolean;
  context?: string; // Surrounding text
  confidence?: number; // Extraction confidence score
  source?: 'regex' | 'mathpix' | 'ocr'; // Extraction method used
  extractedAt: Date;
}

export interface ExtractedChart {
  id: string;
  documentId: string;
  pageNumber?: number;
  imageId: string; // Reference to ExtractedImage
  chartType?: 'bar' | 'line' | 'pie' | 'scatter' | 'area' | 'unknown';
  description?: string;
  dataPoints?: any[];
  extractedAt: Date;
}

export interface MultimodalMetadata {
  images: ExtractedImage[];
  tables: ExtractedTable[];
  equations: ExtractedEquation[];
  charts: ExtractedChart[];
  summary: {
    imageCount: number;
    tableCount: number;
    equationCount: number;
    chartCount: number;
  };
}

export interface DetectedObject {
  label: string;
  confidence: number;
  bbox?: { x: number; y: number; width: number; height: number };
}

export interface OCRText {
  text: string;
  language?: string;
  confidence?: number;
  bbox?: { x: number; y: number; width: number; height: number };
}

export interface ImageAnalysisResult {
  caption: string;
  description?: string;
  tags: string[];
  objects?: DetectedObject[];
  text?: string | string[] | OCRText[];
  chartType?: 'bar' | 'line' | 'pie' | 'scatter' | 'area' | 'unknown';
  confidence?: number;
  model?: string;
  processedAt?: Date;
  isChart?: boolean;
}

export interface TableAnalysisResult {
  structure: {
    rows: number;
    columns: number;
    hasHeaders: boolean;
  };
  headers?: string[];
  dataTypes?: string[];
  summary?: string;
}

export interface EquationAnalysisResult {
  parsed: {
    latex: string;
    description: string;
  };
  complexity: 'simple' | 'moderate' | 'complex';
  variables?: string[];
}

