"use client"

import type React from "react"
import { useState, useRef } from "react"
import { Upload, FileText, Loader2, CheckCircle, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { RAGEngine } from "@/lib/rag-engine"

interface Document {
  id: string
  name: string
  content: string
  chunks: string[]
  embeddings: number[][]
  uploadedAt: Date
  metadata?: any
}

interface PDFProcessorProps {
  onDocumentProcessed: (document: Document) => void
  isProcessing: boolean
  setIsProcessing: (processing: boolean) => void
}

export function PDFProcessor({ onDocumentProcessed, isProcessing, setIsProcessing }: PDFProcessorProps) {
  const [uploadProgress, setUploadProgress] = useState(0)
  const [processingStage, setProcessingStage] = useState("")
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const ragEngine = useRef<RAGEngine>(new RAGEngine())

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

    setIsProcessing(true)
    setUploadProgress(0)
    setError(null)

    try {
      // Initialize RAG engine if not already done
      setProcessingStage("Initializing models...")
      setUploadProgress(10)
      await ragEngine.current.initialize()

      // Process the PDF document
      setProcessingStage("Extracting text from PDF...")
      setUploadProgress(30)

      const document = await ragEngine.current.processDocument(file)

      setProcessingStage("Generating embeddings...")
      setUploadProgress(80)

      // Small delay to show progress
      await new Promise((resolve) => setTimeout(resolve, 500))

      setProcessingStage("Finalizing...")
      setUploadProgress(100)

      onDocumentProcessed(document)

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }

      setProcessingStage("Complete!")
    } catch (error) {
      console.error("Error processing PDF:", error)
      setError(error instanceof Error ? error.message : "Error processing PDF. Please try again.")
    } finally {
      setTimeout(() => {
        setIsProcessing(false)
        setUploadProgress(0)
        setProcessingStage("")
        setError(null)
      }, 1000)
    }
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
          <div className="mb-4 p-3 border border-red-500 bg-red-50 text-red-700 text-sm">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {!isProcessing ? (
          <div className="space-y-3">
            <FileText className="w-12 h-12 mx-auto text-gray-600" />
            <div>
              <p className="font-medium">UPLOAD PDF DOCUMENT</p>
              <p className="text-sm text-gray-600 mt-1">Click to select a PDF file for processing</p>
              <p className="text-xs text-gray-500 mt-1">Supports text-based PDFs up to 10MB</p>
            </div>
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              className="border-black text-black hover:bg-black hover:text-white"
            >
              <Upload className="w-4 h-4 mr-2" />
              SELECT FILE
            </Button>
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
