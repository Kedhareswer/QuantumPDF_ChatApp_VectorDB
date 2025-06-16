// This is a browser-compatible version of the PDF processor
// It avoids using Node.js specific modules

import { EnhancedPDFProcessor } from "./enhanced-pdf-processor"

// Export the browser-compatible processor
export { EnhancedPDFProcessor }

// Add any browser-specific utilities here
export const isBrowserEnvironment = typeof window !== "undefined"

export const getBrowserInfo = () => {
  if (!isBrowserEnvironment) return { name: "Unknown", version: "Unknown" }

  const userAgent = navigator.userAgent
  let browserName = "Unknown"
  let browserVersion = "Unknown"

  if (userAgent.indexOf("Chrome") > -1) {
    browserName = "Chrome"
    browserVersion = userAgent.match(/Chrome\/([0-9.]+)/)?.[1] || "Unknown"
  } else if (userAgent.indexOf("Firefox") > -1) {
    browserName = "Firefox"
    browserVersion = userAgent.match(/Firefox\/([0-9.]+)/)?.[1] || "Unknown"
  } else if (userAgent.indexOf("Safari") > -1) {
    browserName = "Safari"
    browserVersion = userAgent.match(/Version\/([0-9.]+)/)?.[1] || "Unknown"
  } else if (userAgent.indexOf("Edge") > -1) {
    browserName = "Edge"
    browserVersion = userAgent.match(/Edge\/([0-9.]+)/)?.[1] || "Unknown"
  }

  return { name: browserName, version: browserVersion }
}

export const checkPDFJSCompatibility = async () => {
  try {
    // Use dynamic import for better tree-shaking and compatibility
    const pdfjs = await import('pdfjs-dist')
    
    // Get the version from the PDF.js library
    const version = '3.4.120' // Hardcoded version as a fallback
    
    // Set worker source if in browser environment
    if (typeof window !== 'undefined' && pdfjs.GlobalWorkerOptions) {
      pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.js`
    }
    
    return {
      compatible: true,
      version,
      features: {
        worker: typeof pdfjs.GlobalWorkerOptions !== "undefined",
        getDocument: typeof pdfjs.getDocument !== "undefined"
      }
    }
  } catch (error) {
    return {
      compatible: false,
      error: error instanceof Error ? error.message : "Unknown error",
      features: {
        worker: false,
        getDocument: false,
      },
    }
  }
}
