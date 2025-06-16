'use client';

// This file provides a safe client-side only PDF.js initialization
// It avoids the "Object.defineProperty called on non-object" error

// We'll use a dynamic import pattern to ensure PDF.js is only loaded in the browser
let pdfjs = null;

// Function to safely load PDF.js in client environment
export async function loadPdfJs() {
  if (typeof window === 'undefined') {
    console.warn('PDF.js cannot be loaded in server environment');
    return null;
  }
  
  if (pdfjs) return pdfjs;
  
  try {
    // Dynamic import to ensure this only runs on the client
    const module = await import('pdfjs-dist/webpack');
    pdfjs = module;
    
    // Set the worker source to CDN
    const pdfWorkerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${module.version}/pdf.worker.min.js`;
    module.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
    
    console.log(`PDF.js loaded successfully (version: ${module.version})`);
    return pdfjs;
  } catch (err) {
    console.error('Error loading PDF.js:', err);
    return null;
  }
}

// Get the loaded PDF.js instance (or null if not loaded)
export function getPdfJs() {
  return pdfjs;
}

// Check if PDF.js is loaded
export function isPdfJsLoaded() {
  return pdfjs !== null;
}
