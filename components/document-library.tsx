"use client"

import { useState } from "react"
import { FileText, Trash2, Eye, Download, Calendar, Hash, Zap, ChevronDown, ChevronRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

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
  const [expandedStats, setExpandedStats] = useState(true)

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

  const handleRemoveDocument = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to remove "${name}"? This action cannot be undone.`)) {
      onRemoveDocument(id)
    }
  }

  if (documents.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center py-16 border-2 border-dashed border-gray-300 card-enhanced">
          <FileText className="w-16 h-16 mx-auto text-gray-400 mb-6" />
          <h2 className="text-hierarchy-2 text-gray-900 mb-3">NO DOCUMENTS</h2>
          <p className="text-gray-600 text-base leading-relaxed max-w-md mx-auto">
            Upload PDF documents to start building your knowledge base and enable AI-powered document analysis
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Library Stats */}
      <Collapsible open={expandedStats} onOpenChange={setExpandedStats}>
        <Card className="card-enhanced">
          <CollapsibleTrigger asChild>
            <CardHeader className="border-b border-black cursor-pointer hover:bg-gray-50 transition-colors">
              <CardTitle className="flex items-center justify-between text-hierarchy-4">
                <div className="flex items-center space-x-3">
                  <Hash className="w-5 h-5" />
                  <span>LIBRARY STATISTICS</span>
                </div>
                {expandedStats ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="text-center space-y-2">
                  <div className="text-2xl font-bold">{documents.length}</div>
                  <div className="text-sm text-gray-600">Documents</div>
                </div>
                <div className="text-center space-y-2">
                  <div className="text-2xl font-bold">{getTotalChunks()}</div>
                  <div className="text-sm text-gray-600">Total Chunks</div>
                </div>
                <div className="text-center space-y-2">
                  <div className="text-2xl font-bold">
                    {documents.reduce((total, doc) => total + (doc.content?.length || 0), 0).toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600">Characters</div>
                </div>
                <div className="text-center space-y-2">
                  <div className="text-2xl font-bold">
                    {documents.reduce((total, doc) => total + (doc.embeddings?.length || 0), 0)}
                  </div>
                  <div className="text-sm text-gray-600">Embeddings</div>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Document List */}
      <div className="space-y-4">
        <h2 className="text-hierarchy-3">Documents ({documents.length})</h2>
        <div className="space-y-4">
          {documents.map((doc) => (
            <Card key={doc.id} className="card-enhanced">
              <CardHeader className="border-b border-black">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-3">
                    <CardTitle className="text-hierarchy-4 truncate flex items-center space-x-3">
                      <FileText className="w-5 h-5 flex-shrink-0" />
                      <span className="truncate" title={doc.name}>
                        {doc.name}
                      </span>
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4" />
                        <time dateTime={doc.uploadedAt.toISOString()}>
                          {new Date(doc.uploadedAt).toLocaleDateString()}
                        </time>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Hash className="w-4 h-4" />
                        <span>{doc.chunks?.length || 0} chunks</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Zap className="w-4 h-4" />
                        <span>{getProcessingMethod(doc)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePreview(doc)}
                      className="border-black text-black hover:bg-black hover:text-white btn-enhanced"
                      aria-label={`${selectedDocument === doc.id ? "Hide" : "Show"} preview for ${doc.name}`}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownload(doc)}
                      className="border-black text-black hover:bg-black hover:text-white btn-enhanced"
                      aria-label={`Download ${doc.name}`}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRemoveDocument(doc.id, doc.name)}
                      className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white btn-enhanced"
                      aria-label={`Remove ${doc.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {selectedDocument === doc.id && (
                <CardContent className="p-6 border-t border-gray-200 bg-gray-50 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div className="space-y-1">
                      <span className="text-gray-600 font-medium">Content Length:</span>
                      <div className="font-mono font-bold">{(doc.content?.length || 0).toLocaleString()} chars</div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-gray-600 font-medium">Embeddings:</span>
                      <div className="font-mono font-bold">{doc.embeddings?.length || 0}</div>
                    </div>
                    {doc.metadata?.pages && (
                      <div className="space-y-1">
                        <span className="text-gray-600 font-medium">Pages:</span>
                        <div className="font-mono font-bold">{doc.metadata.pages}</div>
                      </div>
                    )}
                    {doc.metadata?.title && (
                      <div className="space-y-1">
                        <span className="text-gray-600 font-medium">Title:</span>
                        <div className="font-mono font-bold truncate" title={doc.metadata.title}>
                          {doc.metadata.title}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-hierarchy-4">CONTENT PREVIEW:</h3>
                    <ScrollArea className="h-40 border-2 border-gray-300 p-4 bg-white">
                      <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed">
                        {doc.content?.substring(0, 1000) || "No content available"}
                        {(doc.content?.length || 0) > 1000 && "\n\n... (truncated)"}
                      </pre>
                    </ScrollArea>
                  </div>

                  {doc.metadata?.isFallback && (
                    <Alert className="border-yellow-500 bg-yellow-50">
                      <AlertDescription className="text-sm">
                        <strong>Note:</strong> This document was processed using fallback methods. The original PDF
                        content may not have been fully extracted.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
