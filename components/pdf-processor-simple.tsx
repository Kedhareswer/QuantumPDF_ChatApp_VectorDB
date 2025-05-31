"use client"

import type React from "react"
import { useState, useRef } from "react"
import { Upload, FileText, Loader2, CheckCircle, AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { PDFParser } from "@/lib/pdf-parser"

interface Document {
  id: string
  name: string
  content: string
  chunks: string[]
  embeddings: number[][]
  uploadedAt: Date
  metadata?: any
}

interface PDFProcessorSimpleProps {
  onDocumentProcessed: (document: Document) => void
  isProcessing: boolean
  setIsProcessing: (processing: boolean) => void
}

export function PDFProcessorSimple({ onDocumentProcessed, isProcessing, setIsProcessing }: PDFProcessorSimpleProps) {
  const [uploadProgress, setUploadProgress] = useState(0)
  const [processingStage, setProcessingStage] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [currentFile, setCurrentFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pdfParser = useRef<PDFParser>(new PDFParser())

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      setError("No file selected")
      return
    }

    if (file.type !== "application/pdf") {
      setError("Please select a PDF file")
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("File size exceeds 10MB limit")
      return
    }

    setCurrentFile(file)
    await processFile(file)
  }

  const processFile = async (file: File) => {
    setIsProcessing(true)
    setUploadProgress(0)
    setError(null)

    try {
      setProcessingStage("Preparing file...")
      setUploadProgress(10)

      // Try PDF.js processing
      await processWithPDFJS(file)
    } catch (pdfError) {
      console.warn("PDF.js processing failed:", pdfError)

      try {
        // Try server-side processing
        await processWithServer(file)
      } catch (serverError) {
        console.warn("Server processing failed:", serverError)

        // Use text-based fallback
        await processWithTextFallback(file)
      }
    } finally {
      setTimeout(() => {
        setIsProcessing(false)
        setUploadProgress(0)
        setProcessingStage("")
      }, 1000)
    }
  }

  const processWithPDFJS = async (file: File) => {
    setProcessingStage("Extracting text with PDF.js...")
    setUploadProgress(30)

    try {
      const pdfContent = await pdfParser.current.extractText(file)

      setProcessingStage("Creating text chunks...")
      setUploadProgress(70)

      const chunks = pdfParser.current.chunkText(pdfContent.text)

      if (chunks.length === 0) {
        throw new Error("No text chunks could be created from the PDF")
      }

      setProcessingStage("Finalizing...")
      setUploadProgress(100)

      const document: Document = {
        id: Date.now().toString(),
        name: file.name,
        content: pdfContent.text,
        chunks,
        embeddings: [],
        uploadedAt: new Date(),
        metadata: {
          ...pdfContent.metadata,
          processingMethod: "PDF.js",
        },
      }

      onDocumentProcessed(document)
      resetFileInput()
      setProcessingStage("Complete!")
    } catch (error) {
      console.error("PDF.js processing error:", error)
      throw error
    }
  }

  const processWithServer = async (file: File) => {
    setProcessingStage("Uploading to server...")
    setUploadProgress(20)

    const formData = new FormData()
    formData.append("pdf", file)

    try {
      const response = await fetch("/api/pdf/extract", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`)
      }

      setProcessingStage("Server processing...")
      setUploadProgress(60)

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || "Server processing failed")
      }

      setProcessingStage("Finalizing...")
      setUploadProgress(100)

      const document: Document = {
        id: Date.now().toString(),
        name: file.name,
        content: data.text,
        chunks: data.chunks,
        embeddings: [],
        uploadedAt: new Date(),
        metadata: {
          ...data.metadata,
          processingMethod: "Server",
        },
      }

      onDocumentProcessed(document)
      resetFileInput()
      setProcessingStage("Complete!")
    } catch (error) {
      console.error("Server processing error:", error)
      throw error
    }
  }

  const processWithTextFallback = async (file: File) => {
    setProcessingStage("Creating text-based document...")
    setUploadProgress(50)

    // Create a comprehensive fallback document
    const fallbackText = `
# Document: ${file.name}

## File Information
- **Filename**: ${file.name}
- **Size**: ${(file.size / 1024 / 1024).toFixed(2)} MB
- **Upload Date**: ${new Date().toLocaleString()}
- **Processing Method**: Text Fallback

## Content Notice
This PDF could not be processed using standard text extraction methods. This might occur with:

### Possible Reasons:
1. **Image-based PDF**: The document contains scanned images rather than selectable text
2. **Complex formatting**: Advanced layouts that interfere with text extraction
3. **Security restrictions**: Browser security settings preventing PDF processing
4. **Corrupted file**: The PDF file may have structural issues

### What You Can Do:
1. **Try OCR**: Use Optical Character Recognition software to convert images to text
2. **Re-save PDF**: Try saving the PDF in a different format or from a different source
3. **Manual input**: Copy and paste text content manually if possible
4. **Alternative formats**: Convert to Word document or plain text file

### Using This Document:
You can still ask questions about this document, and the chatbot will use this information to provide relevant responses about PDF processing and troubleshooting.

## Sample Questions You Can Ask:
- "What are the common issues with PDF processing?"
- "How can I convert an image-based PDF to text?"
- "What file formats work best for text extraction?"
- "Why might a PDF fail to process?"

This fallback document ensures you can still interact with the chatbot and get helpful information about document processing.
    `.trim()

    const chunks = chunkText(fallbackText)

    setProcessingStage("Finalizing fallback document...")
    setUploadProgress(100)

    const document: Document = {
      id: Date.now().toString(),
      name: `${file.name} (Text Fallback)`,
      content: fallbackText,
      chunks,
      embeddings: [],
      uploadedAt: new Date(),
      metadata: {
        title: file.name,
        pages: 1,
        author: "PDF Processor",
        subject: "Fallback text document",
        processingMethod: "Text Fallback",
        originalSize: file.size,
        isFallback: true,
      },
    }

    onDocumentProcessed(document)
    resetFileInput()
    setProcessingStage("Fallback complete!")
    setError("PDF text could not be extracted. Created a text-based document instead.")
  }

  const chunkText = (text: string, chunkSize = 500, overlap = 50): string[] => {
    if (!text || text.trim().length === 0) {
      return ["No content available"]
    }

    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0)
    const chunks: string[] = []
    let currentChunk = ""

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim()
      if (!trimmedSentence) continue

      const potentialChunk = currentChunk + (currentChunk ? ". " : "") + trimmedSentence

      if (potentialChunk.length <= chunkSize) {
        currentChunk = potentialChunk
      } else {
        if (currentChunk) {
          chunks.push(currentChunk + ".")
        }
        currentChunk = trimmedSentence
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk + ".")
    }

    return chunks.filter((chunk) => chunk.trim().length > 0)
  }

  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
    setCurrentFile(null)
  }

  const handleRetry = () => {
    if (currentFile) {
      processFile(currentFile)
    }
  }

  const handleManualText = () => {
    // Create a simple text document that users can edit
    const manualText = `
# Manual Text Document

Please replace this content with your own text. You can:

1. Copy and paste text from your PDF
2. Type your content directly
3. Add any information you want to chat about

## Example Content:
This is where you would put the actual content from your document. The chatbot will be able to answer questions based on whatever text you provide here.

## Instructions:
- Replace this placeholder text with your actual content
- The chatbot will use this text to answer your questions
- You can edit this anytime by uploading a new document
    `.trim()

    const chunks = chunkText(manualText)

    const document: Document = {
      id: Date.now().toString(),
      name: "Manual Text Document",
      content: manualText,
      chunks,
      embeddings: [],
      uploadedAt: new Date(),
      metadata: {
        title: "Manual Text Document",
        pages: 1,
        author: "User",
        subject: "Manual text input",
        processingMethod: "Manual",
        isManual: true,
      },
    }

    onDocumentProcessed(document)
    resetFileInput()
    setError(null)
  }

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-black p-6 text-center">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileUpload}
          className="hidden"
          disabled={isProcessing}
        />

        {error && (
          <Alert
            className="mb-4"
            variant={error.includes("Fallback") || error.includes("text-based") ? "default" : "destructive"}
          >
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{error}</span>
              <div className="flex gap-2 ml-2">
                {currentFile && (
                  <Button size="sm" variant="outline" onClick={handleRetry}>
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Retry
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={handleManualText}>
                  <FileText className="w-3 h-3 mr-1" />
                  Manual Text
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {!isProcessing ? (
          <div className="space-y-4">
            <FileText className="w-12 h-12 mx-auto text-gray-600" />
            <div>
              <p className="font-medium">UPLOAD PDF DOCUMENT</p>
              <p className="text-sm text-gray-600 mt-1">Click to select a PDF file for processing</p>
              <p className="text-xs text-gray-500 mt-1">
                Supports text-based PDFs up to 10MB • Multiple processing methods available
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="border-black text-black hover:bg-black hover:text-white"
              >
                <Upload className="w-4 h-4 mr-2" />
                SELECT PDF FILE
              </Button>
              <Button
                onClick={handleManualText}
                variant="outline"
                className="border-gray-400 text-gray-600 hover:bg-gray-100 text-sm"
              >
                <FileText className="w-3 h-3 mr-2" />
                CREATE TEXT DOCUMENT
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {uploadProgress === 100 ? (
              <CheckCircle className="w-12 h-12 mx-auto text-green-600" />
            ) : (
              <Loader2 className="w-12 h-12 mx-auto animate-spin" />
            )}
            <div>
              <p className="font-medium">PROCESSING DOCUMENT</p>
              <p className="text-sm text-gray-600 mt-1">{processingStage}</p>
            </div>
            <Progress value={uploadProgress} className="w-full" />
            <p className="text-xs text-gray-500">{uploadProgress}% complete</p>
          </div>
        )}
      </div>
    </div>
  )
}
