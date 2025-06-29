"use client"

import { useState } from "react"
import { 
  FileText, 
  Trash2, 
  Eye, 
  Download, 
  Calendar, 
  Hash, 
  Zap, 
  ChevronDown, 
  ChevronRight, 
  Archive, 
  FileArchive, 
  Folder, 
  BarChart3, 
  ChevronUp, 
  Loader2, 
  FileJson,
  MoreVertical,
  Share
} from "lucide-react"
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
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { DocumentLibrarySkeleton, BulkExportLoadingSkeleton } from "@/components/skeleton-loaders"
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
  const [expandedStats, setExpandedStats] = useState(false) // Collapsed by default on mobile
  const [isBulkExporting, setIsBulkExporting] = useState(false)
  const [exportOperation, setExportOperation] = useState<string | null>(null)
  const { toast } = useToast()

  // Show skeleton during loading
  if (isLoading) {
    return <DocumentLibrarySkeleton />
  }

  // Show bulk export loading
  if (isBulkExporting) {
    return <BulkExportLoadingSkeleton />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
  }

  const getTotalChunks = () => {
    return documents.reduce((total, doc) => total + (doc.chunks?.length || 0), 0)
  }

  const getProcessingMethod = (doc: Document) => {
    return doc.metadata?.processingMethod || doc.metadata?.aiProvider || "Standard"
  }

  const getConfidenceScore = (doc: Document) => {
    const confidence = doc.metadata?.confidence || 0
    if (confidence > 1) {
      return Math.min(confidence / 100, 1)
    }
    return Math.min(Math.max(confidence, 0), 1)
  }

  const getTotalSize = () => {
    return documents.reduce((total, doc) => {
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
        title: "Downloaded",
        description: `${filename}`,
      })
    } catch (error) {
      console.error('Download failed:', error)
      toast({
        title: "Download Failed",
        description: "An error occurred while downloading.",
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
        description: "JSON export successful.",
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
        description: "Markdown export successful.",
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

  const handleRemoveDocument = (id: string, name: string) => {
    if (window.confirm(`Remove "${name}"?`)) {
      onRemoveDocument(id)
    }
  }

  if (documents.length === 0) {
    return (
      <div className="space-y-4">
        <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
          <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h2 className="text-base font-bold text-gray-900 mb-2">NO DOCUMENTS</h2>
          <p className="text-sm text-gray-600 leading-relaxed max-w-xs mx-auto px-4">
            Upload PDF documents to start building your knowledge base
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Mobile Library Stats - Collapsed by default */}
      <Collapsible open={expandedStats} onOpenChange={setExpandedStats}>
        <Card className="border-2 border-black shadow-sm">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors p-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-bold flex items-center space-x-2">
                  <Archive className="w-3 h-3" />
                  <span>LIBRARY</span>
                  <Badge variant="outline" className="text-xs">{documents.length}</Badge>
                </CardTitle>
                <div className="flex items-center space-x-2">
                  {/* Mobile Bulk Export */}
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-gray-300 text-gray-700 hover:bg-gray-900 hover:text-white h-6 px-2 text-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Download className="w-3 h-3" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="h-64">
                      <div className="space-y-3">
                        <h3 className="text-sm font-bold">Export Library</h3>
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant="outline"
                            onClick={handleBulkExportJSON}
                            disabled={exportOperation === "json"}
                            className="h-12 text-xs flex-col"
                          >
                            {exportOperation === "json" ? (
                              <Loader2 className="w-4 h-4 animate-spin mb-1" />
                            ) : (
                              <FileJson className="w-4 h-4 mb-1" />
                            )}
                            JSON Data
                          </Button>
                          <Button
                            variant="outline"
                            onClick={handleBulkExportMarkdown}
                            disabled={exportOperation === "markdown"}
                            className="h-12 text-xs flex-col"
                          >
                            {exportOperation === "markdown" ? (
                              <Loader2 className="w-4 h-4 animate-spin mb-1" />
                            ) : (
                              <FileText className="w-4 h-4 mb-1" />
                            )}
                            Markdown
                          </Button>
                        </div>
                      </div>
                    </SheetContent>
                  </Sheet>
                  
                  {expandedStats ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="p-3 space-y-3">
              {/* Mobile Statistics Grid */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-2 rounded border border-blue-200">
                  <div className="text-center">
                    <FileText className="w-4 h-4 text-blue-600 mx-auto mb-1" />
                    <div className="text-lg font-bold text-blue-700">{documents.length}</div>
                    <div className="text-xs text-blue-600">Docs</div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-green-50 to-green-100 p-2 rounded border border-green-200">
                  <div className="text-center">
                    <Hash className="w-4 h-4 text-green-600 mx-auto mb-1" />
                    <div className="text-lg font-bold text-green-700">{getTotalChunks()}</div>
                    <div className="text-xs text-green-600">Chunks</div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-2 rounded border border-purple-200">
                  <div className="text-center">
                    <Archive className="w-4 h-4 text-purple-600 mx-auto mb-1" />
                    <div className="text-lg font-bold text-purple-700">{formatFileSize(getTotalSize())}</div>
                    <div className="text-xs text-purple-600">Size</div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-2 rounded border border-orange-200">
                  <div className="text-center">
                    <Zap className="w-4 h-4 text-orange-600 mx-auto mb-1" />
                    <div className="text-lg font-bold text-orange-700">
                      {documents.length > 0 ? Math.round(documents.reduce((sum, doc) => sum + getConfidenceScore(doc), 0) / documents.length * 100) : 0}%
                    </div>
                    <div className="text-xs text-orange-600">Quality</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Mobile Document List */}
      <ScrollArea className="max-h-96">
        <div className="space-y-2">
          {documents.map((doc) => (
            <Card key={doc.id} className="border border-gray-300 hover:shadow-sm transition-shadow">
              <CardContent className="p-3">
                {/* Mobile Document Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-900 truncate mb-1">
                      {doc.name}
                    </h3>
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>{doc.chunks?.length || 0} chunks</span>
                    </div>
                  </div>
                  
                  {/* Mobile Document Actions */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                        <MoreVertical className="w-3 h-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={() => handlePreview(doc)}>
                        <Eye className="w-3 h-3 mr-2" />
                        Preview
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleDownload(doc, 'txt')}>
                        <Download className="w-3 h-3 mr-2" />
                        Download TXT
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDownload(doc, 'json')}>
                        <FileJson className="w-3 h-3 mr-2" />
                        Download JSON
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDownload(doc, 'chunks')}>
                        <Hash className="w-3 h-3 mr-2" />
                        Download Chunks
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => handleRemoveDocument(doc.id, doc.name)}
                        className="text-red-600"
                      >
                        <Trash2 className="w-3 h-3 mr-2" />
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Mobile Document Metadata */}
                <div className="flex flex-wrap gap-1 mb-2">
                  <Badge variant="outline" className="text-xs">
                    {formatFileSize(doc.metadata?.size || 0)}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {getProcessingMethod(doc)}
                  </Badge>
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${getQualityBadgeColor(doc.metadata?.extractionQuality || "unknown")}`}
                  >
                    {(getConfidenceScore(doc) * 100).toFixed(0)}%
                  </Badge>
                </div>

                {/* Mobile Document Preview */}
                {selectedDocument === doc.id && (
                  <div className="mt-3 p-2 bg-gray-50 rounded border">
                    <ScrollArea className="max-h-32">
                      <p className="text-xs text-gray-700 leading-relaxed">
                        {doc.content.substring(0, 300)}
                        {doc.content.length > 300 && "..."}
                      </p>
                    </ScrollArea>
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">
                          {doc.chunks?.length || 0} chunks • {doc.content.length} chars
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedDocument(null)}
                          className="h-6 px-2 text-xs"
                        >
                          Close
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
} 