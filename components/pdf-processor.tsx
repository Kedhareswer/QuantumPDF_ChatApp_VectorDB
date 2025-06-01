"use client"

import type React from "react"
import { useState, useRef } from "react"
import { Upload, FileText, Loader2, CheckCircle, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { PDFParser } from "@/lib/pdf-parser" // Assuming path
import type { RAGEngine } from "@/lib/rag-engine" // Assuming path
import type { Document } from "@/lib/types" // Assuming path for Document type

interface PDFProcessorProps {
  onDocumentProcessed: (document: Document) => void
  isProcessing: boolean
  setIsProcessing: (processing: boolean) => void
  ragEngine: RAGEngine // Added ragEngine prop
}

export function PDFProcessor({
  onDocumentProcessed,
  isProcessing,
  setIsProcessing,
  ragEngine,
}: PDFProcessorProps) {
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
    setProcessingStage("Starting processing...")

    try {
      // Attempt Client-Side Processing
      try {
        setProcessingStage("Starting client-side processing...")
        setUploadProgress(10) // Initial progress
        const processedDocument = await ragEngine.processDocument(file)
        setUploadProgress(100)
        setProcessingStage("Client-side processing complete!")
        onDocumentProcessed(processedDocument)
        if (fileInputRef.current) fileInputRef.current.value = ""
        return // Successfully processed client-side
      } catch (clientError) {
        console.error("Client-side processing failed:", clientError)
        setError("Client-side processing failed. Attempting server-side extraction...")
        setProcessingStage("Client-side processing failed. Attempting server-side extraction...")
        setUploadProgress(20) // Progress after client-side attempt
        // Do not re-throw, proceed to server-side fallback
      }

      // Server-Side Processing Fallback
      setProcessingStage("Starting server-side extraction...")
      setUploadProgress(30)
      const formData = new FormData()
      formData.append("pdf", file) // Ensure key matches server: "pdf"

      const response = await fetch("/api/pdf/extract", {
        method: "POST",
        body: formData,
      })
      setUploadProgress(50)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) // Attempt to parse JSON error response
        let detailedError = "Failed to process PDF on server."; // Default message
        if (errorData.error) {
          detailedError = errorData.error; // Use specific error from server if available
        } else if (response.statusText) {
          detailedError = `Server responded with status: ${response.statusText}`;
        }
        throw new Error(detailedError);
      }

      const jsonData = await response.json()

      if (!jsonData.success) {
        throw new Error(jsonData.error || "Server returned an error during PDF extraction.")
      }

      setProcessingStage("Server-side extraction complete. Processing text...")
      setUploadProgress(60)

      if (!jsonData.text || jsonData.text.trim() === "") {
        throw new Error("No text content found after server-side extraction.")
      }

      const chunks = ragEngine.pdfParser.chunkText(jsonData.text)
      if (!chunks || chunks.length === 0) {
        throw new Error("Failed to chunk text from server-extracted content.")
      }
      setProcessingStage("Text chunked. Generating embeddings for server-extracted text...")
      setUploadProgress(70)

      const embeddings = await ragEngine.aiClient.generateEmbeddings(chunks)
      if (!embeddings || embeddings.length !== chunks.length) {
        throw new Error("Failed to generate embeddings for server-extracted content.")
      }
      setProcessingStage("Embeddings generated.")
      setUploadProgress(90)

      const documentFromServer: Document = {
        id: Date.now().toString(), // Or generate a more robust ID
        name: file.name,
        content: jsonData.text,
        chunks,
        embeddings,
        uploadedAt: new Date(),
        metadata: {
          ...(jsonData.metadata || {}), // Spread server metadata
          originalFileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          processingMethod: "server-fallback",
          // Add other relevant client-known metadata if jsonData.metadata is sparse
        },
      }

      setProcessingStage("Server-side processing complete!")
      setUploadProgress(100)
      onDocumentProcessed(documentFromServer)

      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } catch (error) {
      console.error("Error processing PDF:", error)
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during PDF processing."
      setError(`Processing failed: ${errorMessage}`)
      setProcessingStage("Failed to process document.")
    } finally {
      // Keep the final state for a bit before resetting, or reset immediately
      // For now, let's rely on the parent component to manage isProcessing state for UI feedback
      // but we should reset internal states like progress and stage if not successful
      if (error) { // If there was an error, ensure UI reflects it and stops.
         // setIsProcessing(false); // Let parent handle this based on onDocumentProcessed or error
      } else { // Success
        // Reset after a short delay to show "Complete!" message
        setTimeout(() => {
            setIsProcessing(false)
            setUploadProgress(0)
            setProcessingStage("")
            setError(null)
        }, 1500);
      }
      // If an error occurred, the finally block in the calling component or page
      // should handle setIsProcessing(false). Here we ensure that if an error
      // was caught and set, the processing stage reflects failure.
      // If onDocumentProcessed was called, the parent component should handle setIsProcessing(false).
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
