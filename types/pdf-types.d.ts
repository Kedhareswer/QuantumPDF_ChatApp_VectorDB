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
    getOperatorList(): Promise<PDFOperatorList>;
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

  export interface PDFOperatorList {
    fnArray: any[];
    argsArray: any[];
  }
}

declare module "pdfjs-dist/build/pdf.worker.entry" {
  const workerEntry: any;
  export default workerEntry;
}