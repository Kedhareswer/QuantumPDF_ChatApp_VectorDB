"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ExternalLink, FileText } from "lucide-react"

interface SourceCardProps {
  source: string
  documentName?: string
  page?: number
  similarity?: number
  preview?: string
  documentId?: string
  onViewPage?: (documentId: string, page: number) => void
  index?: number
}

function parseSourceLabel(source: string): { name: string; page?: number } {
  const trimmed = source.trim()

  const sourceTagMatch = trimmed.match(/^\[?SOURCE:\s*(.+?)(?:\s*\|\s*Page\s*(\d+))?\]?$/i)
  if (sourceTagMatch) {
    return {
      name: sourceTagMatch[1].trim(),
      page: sourceTagMatch[2] ? parseInt(sourceTagMatch[2], 10) : undefined,
    }
  }

  const legacyMatch = trimmed.match(/^(.+?)(?:\s*·\s*p\.(\d+))?/i)
  return {
    name: legacyMatch?.[1]?.trim() || source,
    page: legacyMatch?.[2] ? parseInt(legacyMatch[2], 10) : undefined,
  }
}

export function SourceCard({
  source,
  documentName,
  page,
  similarity,
  preview,
  documentId,
  onViewPage}: SourceCardProps) {
  // Parse source string to extract document name and page if not provided
  const parsedSource = parseSourceLabel(source)
  const displayName = documentName || parsedSource.name || source
  const displayPage = page || parsedSource.page
  
  const similarityPercent = similarity ? Math.round(similarity * 100) : undefined
  const similarityColor = similarityPercent 
    ? similarityPercent >= 80 ? "bg-green-500" 
      : similarityPercent >= 60 ? "bg-yellow-500" 
      : "bg-gray-400"
    : "bg-gray-400"
  
  const canViewPage = documentId && displayPage && onViewPage

  return (
    <Card className="group hover:shadow-md transition-shadow border border-gray-300 bg-white">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <FileText className="w-4 h-4 text-gray-600 shrink-0" />
              <span className="text-xs sm:text-sm font-semibold text-gray-900 truncate">
                {displayName}
              </span>
              {displayPage && (
                <Badge variant="outline" className="text-xs border-gray-300 bg-gray-50 shrink-0">
                  Page {displayPage}
                </Badge>
              )}
              {similarityPercent !== undefined && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge 
                        variant="outline" 
                        className={`text-xs border-gray-300 shrink-0 ${
                          similarityPercent >= 80 ? 'bg-green-50 text-green-700 border-green-300' 
                          : similarityPercent >= 60 ? 'bg-yellow-50 text-yellow-700 border-yellow-300'
                          : 'bg-gray-50 text-gray-700'
                        }`}
                      >
                        {similarityPercent}% match
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Similarity score: {similarityPercent}%</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            
            {preview && (
              <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                {preview}
              </p>
            )}
            
            {similarityPercent !== undefined && (
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${similarityColor} transition-all`}
                    style={{ width: `${similarityPercent}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500">{similarityPercent}%</span>
              </div>
            )}
          </div>
          
          {canViewPage && (
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 h-8 px-2 sm:px-3 text-xs hover:bg-gray-100"
              onClick={() => onViewPage(documentId, displayPage)}
            >
              <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
              <span className="hidden sm:inline">View</span>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

interface SourceCardsProps {
  sources: string[]
  chunks?: Array<{
    content: string
    source: string
    similarity: number
    documentId?: string
    documentName?: string
    page?: number
  }>
  onViewPage?: (documentId: string, page: number) => void
}

export function SourceCards({ sources, chunks, onViewPage }: SourceCardsProps) {
  // If we have chunks with metadata, use those; otherwise fall back to sources array
  const sourceData = chunks && chunks.length > 0
    ? chunks.map((chunk, i) => ({
        source: chunk.source,
        documentName: chunk.documentName,
        page: chunk.page,
        similarity: chunk.similarity,
        preview: chunk.content.substring(0, 150) + (chunk.content.length > 150 ? '...' : ''),
        documentId: chunk.documentId,
        index: i
      }))
    : sources.map((source, i) => ({
        source,
        index: i
      }))

  if (sourceData.length === 0) return null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
      {sourceData.map((data, index) => (
        <SourceCard
          key={index}
          source={data.source}
          documentName={data.documentName}
          page={data.page}
          similarity={data.similarity}
          preview={data.preview}
          documentId={data.documentId}
          onViewPage={onViewPage}
          index={data.index}
        />
      ))}
    </div>
  )
}

