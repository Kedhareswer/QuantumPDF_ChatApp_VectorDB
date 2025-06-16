// Type declarations for PDF.js legacy build
declare module 'pdfjs-dist/legacy/build/pdf' {
  // Include basic types that are needed for PDF.js functionality
  const getDocument: any;
  const GlobalWorkerOptions: any;
  const version: string;
  const PDFWorker: any;
  const AnnotationLayer: any;
  const renderTextLayer: any;
  
  export {
    getDocument,
    GlobalWorkerOptions,
    version,
    PDFWorker,
    AnnotationLayer,
    renderTextLayer
  };
}
