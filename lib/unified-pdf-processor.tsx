import { useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';

// Set the worker source path
const workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

interface Document {
  id: string;
  name: string;
  content: string;
  chunks: string[];
  embeddings: number[][];
  uploadedAt: Date;
  metadata: {
    size: number;
    type: string;
    lastModified: Date;
    pageCount: number;
  };
}

interface ErrorMessage {
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
}

interface UnifiedPDFProcessorProps {
  onDocumentProcessed: (doc: Document) => void;
  addError: (error: Omit<ErrorMessage, 'timestamp'>) => void;
}

interface UnifiedPDFProcessorReturn {
  isProcessing: boolean;
  progress: number;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  processPDF: (file: File) => Promise<void>;
  createChunks: (text: string, chunkSize: number, overlap: number) => string[];
}

// Helper function to split text into overlapping chunks
const createChunks = (text: string, chunkSize: number, overlap: number): string[] => {
  if (!text) return [];
  const chunks: string[] = [];
  let startIndex = 0;
  
  if (chunkSize <= 0) return [text];
  if (overlap >= chunkSize) {
    throw new Error('Overlap must be smaller than chunk size');
  }

  while (startIndex < text.length) {
    const endIndex = Math.min(startIndex + chunkSize, text.length);
    chunks.push(text.slice(startIndex, endIndex));
    startIndex = endIndex - overlap;
    if (startIndex >= text.length) break;
  }

  return chunks;
};

const UnifiedPDFProcessor = ({
  onDocumentProcessed,
  addError
}: UnifiedPDFProcessorProps): UnifiedPDFProcessorReturn => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const extractTextFromPDF = useCallback(async (file: File): Promise<string> => {
    try {
      const fileURL = URL.createObjectURL(file);
      const loadingTask = pdfjsLib.getDocument({ url: fileURL });
      const pdf = await loadingTask.promise;
      let fullText = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .filter((item): item is TextItem => 'str' in item)
          .map((item) => item.str)
          .join(' ');
        fullText += `${pageText}\n\n`;
      }

      URL.revokeObjectURL(fileURL);
      return fullText;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error("Error extracting text from PDF:", errorMessage);
      throw new Error(`Failed to extract text from PDF: ${errorMessage}`);
    }
  }, []);

  const processPDF = useCallback(async (file: File): Promise<void> => {
    setIsProcessing(true);
    setProgress(10);

    try {
      const extractedText = await extractTextFromPDF(file);
      setProgress(50);

      const chunks = createChunks(extractedText, 1000, 200);
      setProgress(70);

      const embeddings = await Promise.all<number[]>(
        chunks.map(async () => [0.1, 0.2, 0.3])
      );

      setProgress(90);

      const document: Document = {
        id: Date.now().toString(),
        name: file.name,
        content: extractedText,
        chunks,
        embeddings,
        uploadedAt: new Date(),
        metadata: {
          size: file.size,
          type: file.type,
          lastModified: new Date(file.lastModified),
          pageCount: chunks.length,
        },
      };

      setProgress(100);
      onDocumentProcessed(document);

      setTimeout(() => {
        setIsProcessing(false);
        setProgress(0);
        setSelectedFile(null);
      }, 1000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during PDF processing';
      console.error("Error processing PDF:", errorMessage);
      setIsProcessing(false);
      setProgress(0);

      addError({
        type: "error",
        title: "PDF Processing Failed",
        message: errorMessage
      });
    }
  }, [extractTextFromPDF, onDocumentProcessed, addError]);

  return {
    isProcessing,
    progress,
    selectedFile,
    setSelectedFile,
    processPDF,
    createChunks
  };
};

export default UnifiedPDFProcessor;