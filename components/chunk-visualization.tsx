"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChevronDown, ChevronUp, FileText, Layers, Target } from "lucide-react"
import { useEffect, useRef, useState } from "react"

interface RetrievedChunk {
  content: string
  source: string
  similarity: number
  documentId?: string
  documentName?: string
  page?: number
  chunkType?: string
}

interface ChunkVisualizationProps {
  /** Shown in this order; chunk i is citation number i + 1 in the answer. */
  chunks: RetrievedChunk[]
  onViewPage?: (documentId: string, page: number) => void
  /** Set when a citation chip is clicked; nonce re-triggers a repeat click. */
  focus?: { index: number; nonce: number }
}

export function ChunkVisualization({ chunks, onViewPage, focus }: ChunkVisualizationProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [expandedChunks, setExpandedChunks] = useState<Set<number>>(new Set())
  const [highlighted, setHighlighted] = useState<number | null>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])
  const [seenNonce, setSeenNonce] = useState<number | undefined>(undefined)

  // New chip click: open the panel on the cited chunk (state derived from the prop, during render).
  if (focus && focus.nonce !== seenNonce) {
    setSeenNonce(focus.nonce)
    setIsOpen(true)
    setExpandedChunks((prev) => new Set(prev).add(focus.index))
    setHighlighted(focus.index)
  }

  useEffect(() => {
    if (!focus) return
    // Wait a frame so the collapsible has mounted its content before scrolling.
    const raf = requestAnimationFrame(() =>
      cardRefs.current[focus.index]?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
    )
    const clear = setTimeout(() => setHighlighted(null), 2000)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(clear)
    }
  }, [focus])

  if (!chunks || chunks.length === 0) return null

  const sortedChunks = chunks

  const toggleChunk = (index: number) => {
    const newExpanded = new Set(expandedChunks)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedChunks(newExpanded)
  }

  const getSimilarityColor = (similarity: number) => {
    const percent = Math.round(similarity * 100)
    if (percent >= 80) return "bg-black"
    if (percent >= 60) return "bg-gray-600"
    return "bg-gray-400"
  }

  const getSimilarityBadgeColor = (similarity: number) => {
    const percent = Math.round(similarity * 100)
    if (percent >= 80) return "bg-black text-white border-black"
    if (percent >= 60) return "bg-white text-black border-black"
    return "bg-white text-gray-500 border-gray-300"
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="outline"
          className={`w-full justify-between h-9 rounded-none border-2 border-black px-3 transition-colors ${
            isOpen ? "bg-black text-white hover:bg-black hover:text-white" : "bg-white hover:bg-black hover:text-white"
          }`}
        >
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Sources</span>
            <span className="font-mono text-[11px] px-1 border border-current leading-tight">{chunks.length}</span>
          </div>
          {isOpen ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Card className="mt-2 rounded-none border-2 border-black shadow-none">
          <CardContent className="p-3 sm:p-4">
            <ScrollArea className="h-[300px] sm:h-[400px] pr-4">
              <div className="space-y-3">
                {sortedChunks.map((chunk, index) => {
                  const isExpanded = expandedChunks.has(index)
                  const similarityPercent = Math.round(chunk.similarity * 100)
                  const preview = chunk.content.substring(0, 150)
                  const hasMore = chunk.content.length > 150

                  return (
                    <Card
                      key={index}
                      ref={(el) => { cardRefs.current[index] = el }}
                      className={`border hover:shadow-sm transition-all ${
                        highlighted === index ? "border-blue-500 ring-2 ring-blue-200" : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <CardHeader className="pb-2 p-3 sm:p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded bg-gray-900 text-white text-[11px] font-semibold shrink-0">
                                {index + 1}
                              </span>
                              <FileText className="w-4 h-4 text-gray-600 shrink-0" />
                              <span className="text-xs sm:text-sm font-semibold text-gray-900 truncate">
                                {chunk.documentName || chunk.source}
                              </span>
                              {chunk.page && (
                                <Badge variant="outline" className="text-xs border-gray-300 bg-gray-50 shrink-0">
                                  Page {chunk.page}
                                </Badge>
                              )}
                              <Badge
                                variant="outline"
                                className={`text-xs shrink-0 ${getSimilarityBadgeColor(chunk.similarity)}`}
                              >
                                <Target className="w-3 h-3 mr-1" />
                                {similarityPercent}%
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${getSimilarityColor(chunk.similarity)} transition-all`}
                                  style={{ width: `${similarityPercent}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 p-3 sm:p-4">
                        <div className="text-xs sm:text-sm text-gray-700">
                          {isExpanded ? (
                            <div className="whitespace-pre-wrap">{chunk.content}</div>
                          ) : (
                            <div>
                              {preview}
                              {hasMore && <span className="text-gray-500">...</span>}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-3 gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleChunk(index)}
                            className="h-7 px-2 text-xs"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="w-3 h-3 mr-1" />
                                Show Less
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-3 h-3 mr-1" />
                                Show More
                              </>
                            )}
                          </Button>
                          {chunk.documentId && chunk.page && onViewPage && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onViewPage(chunk.documentId!, chunk.page!)}
                              className="h-7 px-2 text-xs"
                            >
                              View Page
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  )
}

