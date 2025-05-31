"use client"

import type React from "react"
import { useState, useRef } from "react"
import { Upload, FileText, Loader2, CheckCircle, AlertCircle, RefreshCw, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Document {
  id: string
  name: string
  content: string
  chunks: string[]
  embeddings: number[][]
  uploadedAt: Date
  metadata?: any
}

interface PDFProcessorFinalProps {
  onDocumentProcessed: (document: Document) => void
  isProcessing: boolean
  setIsProcessing: (processing: boolean) => void
}

export function PDFProcessorFinal({ onDocumentProcessed, isProcessing, setIsProcessing }: PDFProcessorFinalProps) {
  const [uploadProgress, setUploadProgress] = useState(0)
  const [processingStage, setProcessingStage] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [currentFile, setCurrentFile] = useState<File | null>(null)
  const [processingMethod, setProcessingMethod] = useState<string>("")
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    setProcessingMethod("")

    try {
      // Try PDF.js processing first
      setProcessingMethod("PDF.js Client-side")
      await processWithPDFJS(file)
    } catch (pdfError) {
      console.warn("PDF.js processing failed:", pdfError)

      try {
        // Try server-side processing
        setProcessingMethod("Server-side")
        await processWithServer(file)
      } catch (serverError) {
        console.warn("Server processing failed:", serverError)

        // Use comprehensive fallback
        setProcessingMethod("Text Fallback")
        await processWithTextFallback(file)
      }
    } finally {
      setTimeout(() => {
        setIsProcessing(false)
        setUploadProgress(0)
        setProcessingStage("")
        setProcessingMethod("")
      }, 1000)
    }
  }

  const processWithPDFJS = async (file: File) => {
    setProcessingStage("Loading PDF.js library...")
    setUploadProgress(10)

    try {
      // Dynamic import with better error handling
      const pdfjs = await import("pdfjs-dist")
      const pdfjsLib = pdfjs.default || pdfjs

      console.log("PDF.js loaded:", !!pdfjsLib.getDocument)

      if (!pdfjsLib.getDocument) {
        throw new Error("PDF.js getDocument function not available")
      }

      // Configure worker if possible
      if (typeof window !== "undefined" && pdfjsLib.GlobalWorkerOptions) {
        try {
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`
        } catch (workerError) {
          console.warn("Worker configuration failed:", workerError)
        }
      }

      setProcessingStage("Reading PDF file...")
      setUploadProgress(30)

      const arrayBuffer = await file.arrayBuffer()

      setProcessingStage("Parsing PDF document...")
      setUploadProgress(50)

      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true,
        stopAtErrors: false,
      })

      const pdf = await loadingTask.promise

      setProcessingStage("Extracting text content...")
      setUploadProgress(70)

      let fullText = ""
      let successfulPages = 0

      // Extract text from all pages
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum)
          const textContent = await page.getTextContent()

          const pageText = textContent.items
            .map((item: any) => {
              if (item && typeof item === "object" && "str" in item) {
                return item.str
              }
              return ""
            })
            .filter((text) => text.trim().length > 0)
            .join(" ")

          if (pageText.trim()) {
            fullText += `\n\n--- Page ${pageNum} ---\n${pageText}`
            successfulPages++
          }
        } catch (pageError) {
          console.warn(`Error processing page ${pageNum}:`, pageError)
        }
      }

      if (!fullText.trim() || successfulPages === 0) {
        throw new Error("No readable text content found in PDF")
      }

      setProcessingStage("Creating text chunks...")
      setUploadProgress(90)

      const chunks = chunkText(fullText.trim())

      setProcessingStage("Finalizing...")
      setUploadProgress(100)

      // Get metadata
      let metadata
      try {
        const metadataResult = await pdf.getMetadata()
        metadata = metadataResult.info
      } catch (metaError) {
        console.warn("Could not extract metadata:", metaError)
        metadata = {}
      }

      const document: Document = {
        id: Date.now().toString(),
        name: file.name,
        content: fullText.trim(),
        chunks,
        embeddings: [],
        uploadedAt: new Date(),
        metadata: {
          title: metadata?.Title || file.name,
          author: metadata?.Author || "Unknown",
          subject: metadata?.Subject || "",
          pages: pdf.numPages,
          processingMethod: "PDF.js",
          successfulPages,
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

## Processing Notice
This PDF could not be processed using standard text extraction methods. This typically happens with:

### Common Causes:
1. **Image-based PDFs**: Documents created by scanning physical pages
2. **Complex layouts**: PDFs with advanced formatting that interferes with text extraction
3. **Browser limitations**: Security restrictions or missing dependencies
4. **File corruption**: Structural issues with the PDF file
5. **Password protection**: Encrypted or secured documents

### Recommended Solutions:
1. **OCR Processing**: Use Optical Character Recognition software to convert images to text
2. **File conversion**: Try converting the PDF to Word or plain text format
3. **Manual extraction**: Copy and paste text content directly from the PDF viewer
4. **Alternative browsers**: Try uploading in Chrome, Firefox, or Safari
5. **File repair**: Use PDF repair tools if the file appears corrupted

### How to Use This Document:
Even though the original PDF content couldn't be extracted, you can still:
- Ask questions about PDF processing and troubleshooting
- Get help with document conversion techniques
- Learn about text extraction methods
- Understand common PDF processing issues

### Sample Questions:
- "How can I convert an image-based PDF to text?"
- "What are the best OCR tools for PDF processing?"
- "Why might a PDF fail to process?"
- "How do I check if a PDF contains selectable text?"

## Next Steps:
1. Try the manual text option to create a custom document
2. Convert your PDF using external tools
3. Upload a different PDF file
4. Contact support if you continue having issues

This fallback ensures you can still use the chatbot effectively while working on document processing solutions.
    `.trim()

    const chunks = chunkText(fallbackText)

    setProcessingStage("Finalizing fallback document...")
    setUploadProgress(100)

    const document: Document = {
      id: Date.now().toString(),
      name: `${file.name} (Fallback)`,
      content: fallbackText,
      chunks,
      embeddings: [],
      uploadedAt: new Date(),
      metadata: {
        title: file.name,
        pages: 1,
        author: "PDF Processor",
        subject: "Fallback text document",
        processingMethod: "Fallback",
        originalSize: file.size,
        isFallback: true,
      },
    }

    onDocumentProcessed(document)
    resetFileInput()
    setProcessingStage("Fallback complete!")
    setError("PDF content could not be extracted. Created a helpful guide document instead.")
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
    const manualText = `
# Manual Text Document

## Instructions
Replace this content with your own text. You can:

1. **Copy and paste** text from your PDF using a PDF viewer
2. **Type content directly** that you want to chat about
3. **Add any information** relevant to your questions

## Example Content
This is where you would put the actual content from your document. The chatbot will use this text to answer your questions.

### Sample Text:
"This is an example of content you might add. You can include:
- Key information from your documents
- Important facts or data
- Any text you want to discuss with the chatbot"

## How to Edit:
1. Select all this text and delete it
2. Paste or type your actual content
3. The chatbot will use your text to answer questions
4. You can upload a new document anytime to replace this

## Tips:
- Include headings and structure for better organization
- Add context that might be helpful for questions
- Break up long text into paragraphs for readability
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
            variant={error.includes("Fallback") || error.includes("guide") ? "default" : "destructive"}
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

        {processingMethod && isProcessing && (
          <Alert className="mb-4">
            <Info className="h-4 w-4" />
            <AlertDescription>Processing with: {processingMethod}</AlertDescription>
          </Alert>
        )}

        {!isProcessing ? (
          <div className="space-y-4">
            <FileText className="w-12 h-12 mx-auto text-gray-600" />
            <div>
              <p className="font-medium">UPLOAD PDF DOCUMENT</p>
              <p className="text-sm text-gray-600 mt-1">Click to select a PDF file for processing</p>
              <p className="text-xs text-gray-500 mt-1">
                Multiple processing methods • Automatic fallbacks • Up to 10MB
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
              {processingMethod && <p className="text-xs text-gray-500 mt-1">Method: {processingMethod}</p>}
            </div>
            <Progress value={uploadProgress} className="w-full" />
            <p className="text-xs text-gray-500">{uploadProgress}% complete</p>
          </div>
        )}
      </div>
    </div>
  )
}
