"use client"

import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { FileText } from "lucide-react"
import React from "react"

interface CitationBadgeProps {
  source: string
  documentName?: string
  page?: number
  documentId?: string
  preview?: string
  onClick?: (documentId: string, page: number) => void
  className?: string
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

function normalizeSourceName(name: string): string {
  return name
    .replace(/^\[?SOURCE:\s*/i, "")
    .replace(/\]?$/, "")
    .trim()
    .toLowerCase()
}

export function CitationBadge({
  source,
  documentName,
  page,
  documentId,
  preview,
  onClick,
  className = ""
}: CitationBadgeProps) {
  // Parse source to extract page if not provided
  const parsedSource = parseSourceLabel(source)
  const displayName = documentName || parsedSource.name || source
  const displayPage = page || parsedSource.page
  
  const isClickable = documentId && displayPage && onClick
  
  const badgeContent = (
    <Badge
      variant="outline"
      className={`
        inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium
        border-blue-200 bg-blue-50 text-blue-700
        hover:bg-blue-100 hover:border-blue-300
        transition-colors cursor-pointer
        ${isClickable ? 'hover:shadow-sm' : ''}
        ${className}
      `}
      onClick={isClickable ? () => onClick(documentId, displayPage) : undefined}
    >
      <FileText className="w-3 h-3" />
      <span className="hidden sm:inline">{displayName}</span>
      {displayPage && (
        <>
          <span className="hidden sm:inline">·</span>
          <span>p.{displayPage}</span>
        </>
      )}
    </Badge>
  )

  if (preview) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {badgeContent}
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="text-xs">
              <div className="font-semibold mb-1">{displayName}</div>
              {displayPage && <div className="text-gray-500 mb-1">Page {displayPage}</div>}
              <div className="text-gray-600 line-clamp-3">{preview}</div>
              {isClickable && (
                <div className="text-blue-600 mt-1 text-[10px]">Click to view page</div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return badgeContent
}

// Helper to parse citations from markdown/text and replace with badges
export function parseCitations(
  text: string,
  chunks?: Array<{
    source: string
    documentName?: string
    page?: number
    documentId?: string
    content?: string
  }>
): React.ReactNode[] {
  if (!chunks || chunks.length === 0) {
    return [text]
  }

  const parts: React.ReactNode[] = []
  let lastIndex = 0
  
  // Match citation patterns like [source] or [Document · p.5]
  const citationPattern = /\[([^\]]+)\]/g
  let match
  
  while ((match = citationPattern.exec(text)) !== null) {
    // Add text before citation
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index))
    }
    
    const citationText = match[1]
    const parsedCitation = parseSourceLabel(citationText)
    const citationName = normalizeSourceName(parsedCitation.name || citationText)
    // Find matching chunk
    const chunk = chunks.find(c => 
      c.source.includes(citationText) ||
      normalizeSourceName(c.source).includes(citationName) ||
      citationName.includes(normalizeSourceName(c.documentName || "")) ||
      citationText.includes(`p.${c.page}`) ||
      (parsedCitation.page !== undefined && c.page === parsedCitation.page)
    )
    
    if (chunk) {
      parts.push(
        <CitationBadge
          key={match.index}
          source={chunk.source}
          documentName={chunk.documentName}
          page={chunk.page}
          documentId={chunk.documentId}
          preview={chunk.content?.substring(0, 100)}
        />
      )
    } else {
      // Keep original citation if no match
      parts.push(`[${citationText}]`)
    }
    
    lastIndex = match.index + match[0].length
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex))
  }
  
  return parts.length > 0 ? parts : [text]
}

