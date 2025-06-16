'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { EnhancedPDFProcessor } from '@/lib/enhanced-pdf-processor';

// Props for the PDF client wrapper
interface PDFClientWrapperProps {
  onProcessorReady: (processor: EnhancedPDFProcessor) => void;
}

/**
 * Client-only component that initializes PDF.js and the PDF processor
 * This ensures PDF.js is only loaded in the browser environment
 */
export function PDFClientWrapper({ onProcessorReady }: PDFClientWrapperProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initialize PDF.js and the processor only on the client side
    const initPdfProcessor = async () => {
      try {
        setIsLoading(true);
        
        // Create a new processor instance
        const processor = new EnhancedPDFProcessor();
        
        // Initialize the processor
        const initialized = await processor.initialize();
        
        if (!initialized) {
          throw new Error('Failed to initialize PDF processor');
        }
        
        // Pass the initialized processor back to the parent component
        onProcessorReady(processor);
        setIsLoading(false);
      } catch (err) {
        console.error('Error initializing PDF processor:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setIsLoading(false);
      }
    };

    initPdfProcessor();
  }, [onProcessorReady]);

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded-md">
        <h3 className="font-bold">PDF Processing Error</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <span className="ml-2">Initializing PDF processor...</span>
      </div>
    );
  }

  // Render nothing once the processor is initialized and passed to the parent
  return null;
}
