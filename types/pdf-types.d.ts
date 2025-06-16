/**
 * Type declarations for PDF.js and other dependencies
 */

declare module "pdfjs-dist" {
  export const GlobalWorkerOptions: {
    workerSrc: string;
  };
  
  export interface PDFDocumentProxy {
    numPages: number;
    getPage(pageNumber: number): Promise<PDFPageProxy>;
    getMetadata(): Promise<{ info: Record<string, any>; metadata: any }>;
  }

  export interface PDFPageProxy {
    getTextContent(params?: { normalizeWhitespace?: boolean }): Promise<PDFTextContent>;
    getViewport(params: { scale: number; rotation?: number }): PDFPageViewport;
    render(params: {
      canvasContext: CanvasRenderingContext2D;
      viewport: PDFPageViewport;
    }): PDFRenderTask;
  }

  export interface PDFRenderTask {
    promise: Promise<void>;
    cancel(): void;
  }

  export interface PDFPageViewport {
    width: number;
    height: number;
    scale: number;
  }

  export interface PDFTextContent {
    items: Array<{
      str: string;
      dir: string;
      transform: number[];
      width: number;
      height: number;
      hasEOL?: boolean;
    }>;
    styles: Record<string, any>;
  }

  export function getDocument(data: Uint8Array | { url: string }): PDFDocumentLoadingTask;
  
  export interface PDFDocumentLoadingTask {
    promise: Promise<PDFDocumentProxy>;
    destroy(): void;
  }
}

declare module "pdfjs-dist/build/pdf.worker.entry" {
  const workerEntry: any;
  export default workerEntry;
}

// Add any other missing module declarations here
declare module "chromadb" {
  export class ChromaClient {
    constructor(params?: { path?: string; apiUrl?: string });
    heartbeat(): Promise<number>;
    createCollection(params: { name: string; metadata?: Record<string, any> }): Promise<Collection>;
    getCollection(params: { name: string }): Promise<Collection>;
    listCollections(): Promise<Array<{ name: string; metadata: Record<string, any> }>>;
  }

  export interface Collection {
    name: string;
    count(): Promise<number>;
    add(params: {
      ids: string[];
      embeddings?: number[][];
      metadatas?: Record<string, any>[];
      documents?: string[];
    }): Promise<{ success: boolean }>;
    query(params: {
      queryEmbeddings?: number[][];
      queryTexts?: string[];
      nResults?: number;
      where?: Record<string, any>;
    }): Promise<{
      ids: string[][];
      distances: number[][];
      metadatas: Record<string, any>[][];
      documents: string[][];
    }>;
    delete(params: { ids?: string[]; where?: Record<string, any> }): Promise<{ success: boolean }>;
  }
}
