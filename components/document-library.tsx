"use client"

import { useState } from "react"
import { FileText, Trash2, Eye, Download, Calendar, Hash, Zap, ChevronDown, ChevronRight, Archive, FileArchive, Folder, BarChart3, ChevronUp, Loader2, FileJson } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu"
import { DocumentLibrarySkeleton, BulkExportLoadingSkeleton, DocumentCardSkeleton } from "@/components/skeleton-loaders"
import { useToast } from "@/hooks/use-toast"

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
  isLoading?: boolean
}

export function DocumentLibrary({ documents, onRemoveDocument, isLoading = false }: DocumentLibraryProps) {
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null)
  const [expandedStats, setExpandedStats] = useState(true)
  const [isBulkExporting, setIsBulkExporting] = useState(false)
  const [exportOperation, setExportOperation] = useState<string | null>(null)
  const { toast } = useToast()

  // Show skeleton during loading
  if (isLoading) {
    return <DocumentLibrarySkeleton hasDocuments={documents.length > 0} isProcessing={false} />
  }

  // Show bulk export loading
  if (isBulkExporting) {
    return <BulkExportLoadingSkeleton />
  }

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
    return doc.metadata?.processingMethod || doc.metadata?.aiProvider || "Standard"
  }

  const getConfidenceScore = (doc: Document) => {
    // Ensure confidence is between 0 and 1, and handle various formats
    const confidence = doc.metadata?.confidence || 0
    if (confidence > 1) {
      // If confidence is already a percentage (>1), convert to 0-1 range
      return Math.min(confidence / 100, 1)
    }
    return Math.min(Math.max(confidence, 0), 1) // Clamp between 0 and 1
  }

  const getTotalSize = () => {
    return documents.reduce((total, doc) => {
      // Try multiple possible size sources
      const size = doc.metadata?.size || 
                  doc.metadata?.fileSize || 
                  doc.content?.length || 
                  (doc.chunks?.join('').length || 0)
      return total + size
    }, 0)
  }

  const getQualityBadgeColor = (quality: string) => {
    switch (quality) {
      case "high":
        return "border-green-600 text-green-600 bg-green-50"
      case "medium":
        return "border-yellow-600 text-yellow-600 bg-yellow-50"
      case "low":
        return "border-red-600 text-red-600 bg-red-50"
      default:
        return "border-gray-600 text-gray-600 bg-gray-50"
    }
  }

  const handlePreview = (doc: Document) => {
    setSelectedDocument(selectedDocument === doc.id ? null : doc.id)
  }

  const handleDownload = (doc: Document, format: 'txt' | 'json' | 'chunks' = 'txt') => {
    try {
      let content = ""
      let filename = ""
      let mimeType = ""

      switch (format) {
        case 'txt':
          content = doc.content
          filename = `${doc.name.replace(/\.pdf$/i, "")}_extracted.txt`
          mimeType = "text/plain"
          break

        case 'json':
          content = JSON.stringify({
            document: {
              id: doc.id,
              name: doc.name,
              uploadedAt: doc.uploadedAt.toISOString(),
              content: doc.content,
              chunks: doc.chunks,
              metadata: doc.metadata
            },
            exportedAt: new Date().toISOString()
          }, null, 2)
          filename = `${doc.name.replace(/\.pdf$/i, "")}_data.json`
          mimeType = "application/json"
          break

        case 'chunks':
          content = `# Document Chunks: ${doc.name}\n\n`
          content += `Exported: ${new Date().toLocaleString()}\n`
          content += `Total Chunks: ${doc.chunks.length}\n\n`
          content += '---\n\n'
          
          doc.chunks.forEach((chunk, index) => {
            content += `## Chunk ${index + 1}\n\n`
            content += `${chunk}\n\n`
            content += '---\n\n'
          })
          filename = `${doc.name.replace(/\.pdf$/i, "")}_chunks.md`
          mimeType = "text/markdown"
          break
      }

      const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast({
        title: "Document Downloaded",
        description: `Successfully exported as ${filename}`
      })
    } catch (error) {
      console.error('Download failed:', error)
      toast({
        title: "Download Failed",
        description: "An error occurred while downloading the document.",
        variant: "destructive"
      })
    }
  }

  const handleBulkExportJSON = async () => {
    setExportOperation("json")
    setIsBulkExporting(true)

    try {
      await new Promise(resolve => setTimeout(resolve, 1500))

      const libraryData = {
        metadata: {
          exportDate: new Date().toISOString(),
          documentCount: documents.length,
          totalChunks: getTotalChunks(),
          version: "1.0"
        },
        documents: documents.map(doc => ({
          id: doc.id,
          name: doc.name,
          size: doc.metadata?.size || 0,
          type: doc.metadata?.type || "unknown",
          uploadedAt: doc.uploadedAt,
          chunks: doc.chunks || [],
          metadata: doc.metadata || {},
          processingStats: {
            method: getProcessingMethod(doc),
            confidence: getConfidenceScore(doc),
            quality: doc.metadata?.extractionQuality || "unknown"
          }
        }))
      }

      const blob = new Blob([JSON.stringify(libraryData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `quantum-pdf-library-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast({
        title: "Library Exported",
        description: "Document library exported as JSON successfully.",
      })
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export document library.",
        variant: "destructive",
      })
    } finally {
      setIsBulkExporting(false)
      setExportOperation(null)
    }
  }

  const handleBulkExportMarkdown = async () => {
    setExportOperation("markdown")
    setIsBulkExporting(true)

    try {
      await new Promise(resolve => setTimeout(resolve, 1200))

      let markdown = `# QuantumPDF Document Library\n\n`
      markdown += `**Export Date:** ${new Date().toLocaleDateString()}\n`
      markdown += `**Total Documents:** ${documents.length}\n`
      markdown += `**Total Chunks:** ${getTotalChunks()}\n\n`
      markdown += `---\n\n`

      documents.forEach((doc, index) => {
        markdown += `## ${index + 1}. ${doc.name}\n\n`
        markdown += `- **Size:** ${formatFileSize(doc.metadata?.size || 0)}\n`
        markdown += `- **Type:** ${doc.metadata?.type || "unknown"}\n`
        markdown += `- **Uploaded:** ${new Date(doc.uploadedAt).toLocaleDateString()}\n`
        markdown += `- **Chunks:** ${doc.chunks?.length || 0}\n`
        markdown += `- **Processing Method:** ${getProcessingMethod(doc)}\n`
        markdown += `- **Confidence:** ${(getConfidenceScore(doc) * 100).toFixed(1)}%\n\n`
        
        if (doc.chunks && doc.chunks.length > 0) {
          markdown += `### Content Preview:\n\n`
          markdown += `${doc.chunks[0].substring(0, 200)}...\n\n`
        }
        
        markdown += `---\n\n`
      })

      const blob = new Blob([markdown], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `quantum-pdf-library-${new Date().toISOString().split('T')[0]}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

      toast({
        title: "Library Exported",
        description: "Document library exported as Markdown successfully.",
      })
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export as Markdown.",
        variant: "destructive",
      })
    } finally {
      setIsBulkExporting(false)
      setExportOperation(null)
    }
  }

  const handleBulkExport = async (format: 'json' | 'zip' | 'combined') => {
    if (documents.length === 0) {
      toast({
        title: "No Documents to Export",
        description: "Upload some documents first.",
        variant: "destructive"
      })
      return
    }

    try {
      switch (format) {
        case 'json':
          await handleBulkExportJSON()
          break

        case 'combined':
          let combinedContent = `# QuantumPDF Document Library Export\n\n`
          combinedContent += `**Exported:** ${new Date().toLocaleString()}\n`
          combinedContent += `**Total Documents:** ${documents.length}\n`
          combinedContent += `**Total Chunks:** ${getTotalChunks()}\n\n`
          combinedContent += '---\n\n'

          documents.forEach((doc, index) => {
            combinedContent += `# Document ${index + 1}: ${doc.name}\n\n`
            combinedContent += `**Uploaded:** ${doc.uploadedAt.toLocaleString()}\n`
            combinedContent += `**Chunks:** ${doc.chunks.length}\n`
            combinedContent += `**Processing Method:** ${getProcessingMethod(doc)}\n\n`
            combinedContent += '## Content\n\n'
            combinedContent += `${doc.content}\n\n`
            combinedContent += '---\n\n'
          })

          const mdBlob = new Blob([combinedContent], { type: 'text/markdown' })
          const mdUrl = URL.createObjectURL(mdBlob)
          const mdLink = document.createElement("a")
          mdLink.href = mdUrl
          mdLink.download = `quantum-pdf-combined-${new Date().toISOString().split('T')[0]}.md`
          document.body.appendChild(mdLink)
          mdLink.click()
          document.body.removeChild(mdLink)
          URL.revokeObjectURL(mdUrl)
          break

        case 'zip':
          // Note: For a real ZIP implementation, you'd use a library like JSZip
          toast({
            title: "ZIP Export Not Available",
            description: "Please use JSON or Combined export for now. ZIP functionality requires additional setup.",
            variant: "destructive"
          })
          return
      }

      toast({
        title: "Bulk Export Successful",
        description: `All documents exported in ${format.toUpperCase()} format`
      })
    } catch (error) {
      console.error('Bulk export failed:', error)
      toast({
        title: "Bulk Export Failed",
        description: "An error occurred during bulk export.",
        variant: "destructive"
      })
    }
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
    <div className="space-y-4">
      {/* Enhanced Library Stats */}
      <Collapsible open={expandedStats} onOpenChange={setExpandedStats}>
        <Card className="border-2 border-black shadow-sm">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors p-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center space-x-2">
                  <Archive className="w-4 h-4" />
                  <span>LIBRARY OVERVIEW</span>
                </CardTitle>
                <div className="flex items-center space-x-3">
                  {/* Bulk Export Options */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-gray-300 text-gray-700 hover:bg-gray-900 hover:text-white h-7 px-3 text-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Download className="w-3 h-3 mr-1" />
                        Bulk Export
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuLabel>Export All Documents</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleBulkExport('json')}>
                        <FileText className="w-4 h-4 mr-2" />
                        JSON Library Data
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleBulkExport('combined')}>
                        <Folder className="w-4 h-4 mr-2" />
                        Combined Markdown
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleBulkExport('zip')}>
                        <FileArchive className="w-4 h-4 mr-2" />
                        ZIP Archive (Soon)
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  
                  {expandedStats ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="p-4 space-y-4">
              {/* Main Statistics Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-3 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-center mb-1">
                    <FileText className="w-4 h-4 text-blue-600 mr-1" />
                    <span className="text-xs font-bold text-blue-600 uppercase">DOCS</span>
                </div>
                  <div className="text-xl font-bold text-blue-700 text-center">{documents.length}</div>
                  <div className="text-xs text-blue-600 text-center">Files</div>
                </div>
                
                <div className="bg-gradient-to-br from-green-50 to-green-100 p-3 rounded-lg border border-green-200">
                  <div className="flex items-center justify-center mb-1">
                    <Hash className="w-4 h-4 text-green-600 mr-1" />
                    <span className="text-xs font-bold text-green-600 uppercase">CHUNKS</span>
                  </div>
                  <div className="text-xl font-bold text-green-700 text-center">{getTotalChunks()}</div>
                  <div className="text-xs text-green-600 text-center">Segments</div>
                </div>
                
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-3 rounded-lg border border-purple-200">
                  <div className="flex items-center justify-center mb-1">
                    <Archive className="w-4 h-4 text-purple-600 mr-1" />
                    <span className="text-xs font-bold text-purple-600 uppercase">SIZE</span>
                  </div>
                  <div className="text-xl font-bold text-purple-700 text-center">{formatFileSize(getTotalSize())}</div>
                  <div className="text-xs text-purple-600 text-center">Total</div>
                </div>
                
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-3 rounded-lg border border-orange-200">
                  <div className="flex items-center justify-center mb-1">
                    <Zap className="w-4 h-4 text-orange-600 mr-1" />
                    <span className="text-xs font-bold text-orange-600 uppercase">QUALITY</span>
                  </div>
                  <div className="text-xl font-bold text-orange-700 text-center">
                    {documents.length > 0 ? Math.round(documents.reduce((sum, doc) => sum + getConfidenceScore(doc), 0) / documents.length * 100) : 0}%
                  </div>
                  <div className="text-xs text-orange-600 text-center">Confidence</div>
                </div>
              </div>
              
              {documents.length > 0 && (
                <div className="pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-700 uppercase">Bulk Export</span>
                    <Badge variant="outline" className="text-xs px-2 py-0.5">
                      {documents.length} docs
                    </Badge>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkExportJSON}
                      disabled={exportOperation === "json"}
                      className="border border-gray-300 hover:bg-gray-900 hover:text-white text-xs h-7 px-3"
                    >
                      {exportOperation === "json" ? (
                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      ) : (
                        <FileJson className="w-3 h-3 mr-1" />
                      )}
                      JSON
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkExportMarkdown}
                      disabled={exportOperation === "markdown"}
                      className="border border-gray-300 hover:bg-gray-900 hover:text-white text-xs h-7 px-3"
                    >
                      {exportOperation === "markdown" ? (
                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      ) : (
                        <FileText className="w-3 h-3 mr-1" />
                      )}
                      Markdown
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

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
                    
                    {/* Enhanced Download Options */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-black text-black hover:bg-black hover:text-white btn-enhanced"
                          aria-label={`Download options for ${doc.name}`}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>Export Options</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleDownload(doc, 'txt')}>
                          <FileText className="w-4 h-4 mr-2" />
                          Text Content (.txt)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDownload(doc, 'json')}>
                          <FileText className="w-4 h-4 mr-2" />
                          Full Data (.json)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDownload(doc, 'chunks')}>
                          <FileText className="w-4 h-4 mr-2" />
                          Text Chunks (.md)
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    
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
