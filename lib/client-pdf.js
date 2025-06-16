'use client';

// This file should only be imported from client components
let pdfjsLib = null;

// Dynamic import to ensure this only runs on the client
if (typeof window !== 'undefined') {
  // Use a dynamic import for PDF.js
  import('pdfjs-dist/legacy/build/pdf').then(module => {
    pdfjsLib = module;
    
    // Set the worker source
    const pdfWorkerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${module.version}/pdf.worker.min.js`;
    module.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
  }).catch(err => {
    console.error('Error loading PDF.js:', err);
  });
}

export function getPdfLib() {
  return pdfjsLib;
}

export function isPdfLibReady() {
  return pdfjsLib !== null;
}

// Wait for PDF.js to be ready
export function waitForPdfLib(timeout = 5000) {
  return new Promise((resolve, reject) => {
    if (pdfjsLib) {
      resolve(pdfjsLib);
      return;
    }
    
    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      if (pdfjsLib) {
        clearInterval(checkInterval);
        resolve(pdfjsLib);
      } else if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        reject(new Error('Timeout waiting for PDF.js to load'));
      }
    }, 100);
  });
}
