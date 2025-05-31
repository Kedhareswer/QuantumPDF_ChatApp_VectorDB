"use client"

import { useState } from "react"
import { FileText, Trash2, Eye, Download, Calendar, Hash, Zap } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
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

interface DocumentLibraryProps {
  documents: Document[]
  onRemoveDocument: (id: string) => void
}

export function DocumentLibrary({ documents, onRemoveDocument }: DocumentLibraryProps) {
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null)

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const getTotalChunks = () => {
    return documents.reduce((total, doc) => total + (doc.chunks?.length || 0), 0)
  }

  const getProcessingMethod = (doc: Document) => {
    return doc.metadata?.processingMethod || doc.metadata?.aiProvider || "Unknown"
  }

  const handlePreview = (doc: Document) => {
    setSelectedDocument(selectedDocument === doc.id ? null : doc.id)
  }

  const handleDownload = (doc: Document) => {
    const blob = new Blob([doc.content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${doc.name.replace(/\.pdf$/i, "")}_extracted.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (documents.length === 0) {
    return (
      <div className="space-y-4">
        <div className="text-center py-12 border-2 border-dashed border-gray-300">
          <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">NO DOCUMENTS</h3>
          <p className="text-gray-600 text-sm">Upload PDF documents to start building your knowledge base</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Library Stats */}
      <Card className="border-2 border-black shadow-none">
        <CardHeader className="border-b border-black">
          <CardTitle className="text-sm">LIBRARY STATISTICS</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Documents:</span>
              <span className="font-bold">{documents.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Total Chunks:</span>
              <span className="font-bold">{getTotalChunks()}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Document List */}
      <div className="space-y-3">
        {documents.map((doc) => (
          <Card key={doc.id} className="border-2 border-black shadow-none">
            <CardHeader className="border-b border-black">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-sm truncate flex items-center space-x-2">
                    <FileText className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{doc.name}</span>
                  </CardTitle>
                  <div className="flex items-center space-x-3 mt-2 text-xs text-gray-600">
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Hash className="w-3 h-3" />
                      <span>{doc.chunks?.length || 0} chunks</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Zap className="w-3 h-3" />
                      <span>{getProcessingMethod(doc)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-1 ml-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePreview(doc)}
                    className="border-black text-black hover:bg-black hover:text-white h-8 w-8 p-0"
                  >
                    <Eye className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownload(doc)}
                    className="border-black text-black hover:bg-black hover:text-white h-8 w-8 p-0"
                  >
                    <Download className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onRemoveDocument(doc.id)}
                    className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white h-8 w-8 p-0"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            {selectedDocument === doc.id && (
              <CardContent className="p-4 border-t border-gray-200 bg-gray-50">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-gray-600">Content Length:</span>
                      <span className="ml-2 font-mono">{doc.content?.length || 0} chars</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Embeddings:</span>
                      <span className="ml-2 font-mono">{doc.embeddings?.length || 0}</span>
                    </div>
                    {doc.metadata?.pages && (
                      <div>
                        <span className="text-gray-600">Pages:</span>
                        <span className="ml-2 font-mono">{doc.metadata.pages}</span>
                      </div>
                    )}
                    {doc.metadata?.title && (
                      <div>
                        <span className="text-gray-600">Title:</span>
                        <span className="ml-2 font-mono truncate">{doc.metadata.title}</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <h4 className="text-xs font-bold mb-2">CONTENT PREVIEW:</h4>
                    <ScrollArea className="h-32 border border-gray-300 p-2 bg-white">
                      <pre className="text-xs whitespace-pre-wrap font-mono">
                        {doc.content?.substring(0, 500) || "No content available"}
                        {(doc.content?.length || 0) > 500 && "..."}
                      </pre>
                    </ScrollArea>
                  </div>

                  {doc.metadata?.isFallback && (
                    <Alert>
                      <AlertDescription className="text-xs">
                        This document was created using fallback processing. The original PDF content may not have been
                        fully extracted.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
