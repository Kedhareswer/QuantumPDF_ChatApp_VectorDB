"use client"

import type React from "react"

import { useState } from "react"
import { FileText, Loader2, Upload, X } from "lucide-react"
import { formatBytes } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "@/components/ui/use-toast"

interface PDFUploaderProps {
  onUploadSuccess: (pdf: { id: string; name: string; size: number }) => void
  isUploading: boolean
  setIsUploading: (isUploading: boolean) => void
  pdfs: { id: string; name: string; size: number }[]
  onRemove: (id: string) => void
}

export function PDFUploader({ onUploadSuccess, isUploading, setIsUploading, pdfs, onRemove }: PDFUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [currentFile, setCurrentFile] = useState<string | null>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      // Filter only PDF files
      const pdfFiles = Array.from(files).filter((file) => file.type === "application/pdf")

      if (pdfFiles.length > 0) {
        handleFileUpload(pdfFiles)
      } else {
        toast({
          title: "Invalid file type",
          description: "Please upload PDF files only",
          variant: "destructive",
        })
      }
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileUpload(Array.from(files))
    }
  }

  // Add a file size check before uploading
  const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB limit

  const handleFileUpload = async (files: File[]) => {
    setIsUploading(true)

    for (const file of files) {
      try {
        setCurrentFile(file.name)

        // Check file size
        if (file.size > MAX_FILE_SIZE) {
          toast({
            title: "File too large",
            description: `${file.name} exceeds the 5MB size limit. Please upload a smaller file.`,
            variant: "destructive",
          })
          continue
        }

        const formData = new FormData()
        formData.append("file", file)

        const response = await fetch("/api/pdf", {
          method: "POST",
          body: formData,
        })

        // Check if response is ok before trying to parse JSON
        if (!response.ok) {
          let errorMessage = `Error status: ${response.status}`;
          try {
            // Try to parse as JSON, but handle case where it's not JSON
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
              const errorData = await response.json();
              errorMessage = errorData.error || errorMessage;
            } else {
              // If not JSON, get text instead
              const errorText = await response.text();
              errorMessage = errorText.substring(0, 100); // Limit length
            }
          } catch (parseError) {
            console.error("Error parsing response:", parseError);
            // If we can't parse the response, just use the status
          }
          throw new Error(errorMessage);
        }

        // Now we know the response is OK and should be JSON
        const data = await response.json()

        if (data.success) {
          onUploadSuccess({
            id: data.id,
            name: data.name,
            size: data.size,
          })

          toast({
            title: "PDF uploaded successfully",
            description: `${file.name} has been processed with ${data.chunkCount} chunks`,
          })
        } else {
          const errorMessage = data.error || "Unknown error occurred during PDF upload.";
          console.error("Server response error:", errorMessage);
          throw new Error(errorMessage);
        }
      } catch (error) {
        console.error("Error uploading PDF:", error)
        toast({
          title: "Upload failed",
          description: error instanceof Error ? error.message : "Failed to upload PDF",
          variant: "destructive",
        })
      } finally {
        setCurrentFile(null)
      }
    }

    setIsUploading(false)
  }

  return (
    <div className="flex flex-1 flex-col p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Upload PDFs</h2>
        <p className="text-muted-foreground">Upload PDF documents to chat with them using AI</p>
      </div>

      <div
        className={`mb-6 flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center transition-colors ${
          isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="mb-4 rounded-full bg-primary/10 p-4">
          <Upload size={24} className="text-primary" />
        </div>
        <h3 className="mb-2 text-lg font-medium">Drag & Drop PDFs here</h3>
        <p className="mb-4 max-w-xs text-sm text-muted-foreground">
          Or click the button below to select files from your computer
        </p>
        <Button onClick={() => document.getElementById("pdf-upload-page")?.click()} disabled={isUploading}>
          {isUploading ? (
            <>
              <Loader2 size={16} className="mr-2 animate-spin" />
              {currentFile ? `Uploading ${currentFile}...` : "Uploading..."}
            </>
          ) : (
            "Select PDFs"
          )}
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">Maximum file size: 5MB</p>
        <input
          id="pdf-upload-page"
          type="file"
          accept=".pdf"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          disabled={isUploading}
        />
      </div>

      {pdfs.length > 0 && (
        <div className="flex-1 overflow-hidden rounded-lg border">
          <div className="border-b px-4 py-2">
            <h3 className="font-medium">Uploaded PDFs ({pdfs.length})</h3>
          </div>
          <ScrollArea className="h-[calc(100%-40px)]">
            <div className="divide-y">
              {pdfs.map((pdf) => (
                <div key={pdf.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <FileText size={20} className="text-primary" />
                    <div>
                      <p className="font-medium">{pdf.name}</p>
                      <p className="text-xs text-muted-foreground">{formatBytes(pdf.size)}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => onRemove(pdf.id)}>
                    <X size={16} />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  )
}
