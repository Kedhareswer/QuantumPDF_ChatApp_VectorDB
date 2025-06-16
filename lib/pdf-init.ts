// Client-side PDF.js initialization
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';

// The workerSrc property needs to be specified
const setPdfWorker = () => {
  try {
    const pdfWorkerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
    return true;
  } catch (error) {
    console.error('Failed to set PDF.js worker:', error);
    return false;
  }
};

export const initPdfJs = () => {
  // Only initialize in browser environment
  if (typeof window !== 'undefined') {
    return setPdfWorker();
  }
  return false;
};

export { pdfjsLib };
