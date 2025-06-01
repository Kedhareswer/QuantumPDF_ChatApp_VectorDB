"use client"

import type React from "react"
import { useState, useRef } from "react"
import { Upload, FileText, Loader2, CheckCircle, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

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
      // Simulate initialization
      setProcessingStage("Initializing models...")
      setUploadProgress(10)
      await simulateProcessingDelay(500)

      // Simulate text extraction
      setProcessingStage("Extracting text from PDF...")
      setUploadProgress(30)
      await simulateProcessingDelay(800)

      // Simulate chunking
      setProcessingStage("Chunking text...")
      setUploadProgress(50)
      await simulateProcessingDelay(500)

      // Simulate embedding generation
      setProcessingStage("Generating embeddings...")
      setUploadProgress(80)
      await simulateProcessingDelay(700)

      // Create a mock document with realistic content based on the filename
      const mockDocument = createMockDocument(file)

      setProcessingStage("Finalizing...")
      setUploadProgress(100)
      await simulateProcessingDelay(300)

      onDocumentProcessed(mockDocument)

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

  // Helper function to create a realistic mock document
  const createMockDocument = (file: File): Document => {
    const fileName = file.name.replace(".pdf", "")
    const fileSize = file.size
    const id = Date.now().toString()

    // Generate mock content based on filename
    const topics = [
      "artificial intelligence",
      "machine learning",
      "natural language processing",
      "computer vision",
      "neural networks",
      "deep learning",
      "data science",
      "robotics",
    ]

    // Select a topic based on the file name
    const selectedTopic = topics[Math.floor(Math.random() * topics.length)]

    // Create mock content
    const content = `
      ${fileName} - Document Analysis
      
      This document discusses various aspects of ${selectedTopic} and its applications in modern technology.
      The field of ${selectedTopic} has seen significant advancements in recent years, with applications
      ranging from automated decision-making to pattern recognition and predictive analytics.
      
      Key concepts covered in this document include:
      - Fundamental principles of ${selectedTopic}
      - Historical development and major milestones
      - Current state-of-the-art techniques
      - Future directions and challenges
      - Ethical considerations and societal impact
      
      The document also explores how ${selectedTopic} intersects with other fields such as
      mathematics, computer science, cognitive psychology, and philosophy.
    `.trim()

    // Create chunks
    const chunks = [
      `${fileName} - Introduction to ${selectedTopic}: This section covers the basic concepts and definitions related to ${selectedTopic}.`,
      `${fileName} - Historical Development: This section traces the evolution of ${selectedTopic} from its early beginnings to current state.`,
      `${fileName} - Technical Foundations: This section explains the mathematical and computational foundations of ${selectedTopic}.`,
      `${fileName} - Applications: This section explores various real-world applications of ${selectedTopic} in different domains.`,
      `${fileName} - Future Directions: This section discusses emerging trends and future research directions in ${selectedTopic}.`,
      `${fileName} - Ethical Considerations: This section addresses ethical challenges and considerations in the development and deployment of ${selectedTopic}.`,
    ]

    // Create mock embeddings (5-dimensional vectors for simplicity)
    const embeddings = chunks.map(() => {
      return Array.from({ length: 5 }, () => Math.random())
    })

    return {
      id,
      name: file.name,
      content,
      chunks,
      embeddings,
      uploadedAt: new Date(),
      metadata: {
        fileSize,
        fileType: file.type,
        pageCount: Math.floor(fileSize / 30000) + 1, // Rough estimate of page count
        processingMethod: "mock",
        extractionQuality: "high",
        language: "English",
        topics: [selectedTopic],
      },
    }
  }

  // Helper function to simulate processing delay
  const simulateProcessingDelay = (ms: number) => {
    return new Promise((resolve) => setTimeout(resolve, ms))
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
          aria-label="Upload PDF document"
        />

        {error && (
          <div className="mb-4 p-3 border border-red-500 bg-red-50 text-red-700 text-sm" role="alert">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {!isProcessing ? (
          <div className="space-y-3">
            <FileText className="w-12 h-12 mx-auto text-gray-600" aria-hidden="true" />
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
              <Upload className="w-4 h-4 mr-2" aria-hidden="true" />
              SELECT FILE
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {uploadProgress === 100 ? (
              <CheckCircle className="w-12 h-12 mx-auto text-green-600" aria-hidden="true" />
            ) : (
              <Loader2 className="w-12 h-12 mx-auto animate-spin" aria-hidden="true" />
            )}
            <div>
              <p className="font-medium">PROCESSING DOCUMENT</p>
              <p className="text-sm text-gray-600 mt-1">{processingStage}</p>
            </div>
            <Progress
              value={uploadProgress}
              className="w-full"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={uploadProgress}
              aria-label={`Processing progress: ${uploadProgress}%`}
            />
            <p className="text-xs text-gray-500">{uploadProgress}% complete</p>
          </div>
        )}
      </div>
    </div>
  )
}
