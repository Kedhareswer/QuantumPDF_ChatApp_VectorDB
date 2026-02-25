// Type declarations for PDF.js legacy build
declare module 'pdfjs-dist/legacy/build/pdf' {
  // Include basic types that are needed for PDF.js functionality
  const getDocument: unknown;
  const GlobalWorkerOptions: unknown;
  const version: string;
  const PDFWorker: unknown;
  const AnnotationLayer: unknown;
  const renderTextLayer: unknown;
  
  export {
        AnnotationLayer, GlobalWorkerOptions, PDFWorker, getDocument, renderTextLayer, version
    };
}
