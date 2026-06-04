"use client"

import { logger } from "@/lib/logger"
import type React from "react"
import { useEffect, useRef, useState } from "react"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
// @ts-expect-error - missing types
import remarkMath from 'remark-math'
// @ts-expect-error - missing types
import Mermaid from '@/components/mermaid'
import type { Components } from 'react-markdown'
import rehypeKatex from 'rehype-katex'

import { ChunkVisualization } from "@/components/chunk-visualization"
import { DocumentFilter } from "@/components/document-filter"
import { QueryHistory } from "@/components/query-history"
import { QuickActions } from "@/components/quick-actions"
import { EnhancedChatProcessingSkeleton } from "@/components/skeleton-loaders"
import { ThinkingBubble } from "@/components/thinking-bubble"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import { useAppStore } from "@/lib/store"
import {
    Brain,
    ChevronDown,
    ChevronRight,
    Clock,
    Eye,
    FileText,
    HelpCircle,
    Loader2,
    MessageSquare,
    Send,
    Settings,
    Sparkles,
    Target,
    Zap,
} from "lucide-react"

interface RetrievedChunk {
  content: string
  source: string
  similarity: number
  documentId?: string
  documentName?: string
  page?: number
  bbox?: unknown
  level?: number
  chunkType?: string
}

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  sources?: string[]
  metadata?: {
    responseTime?: number
    relevanceScore?: number
    retrievedChunks?: RetrievedChunk[] // Full chunks array with metadata
    qualityMetrics?: {
      accuracyScore: number
      completenessScore: number
      clarityScore: number
      confidenceScore: number
      finalRating: number
    }
    tokenUsage?: {
      contextTokens: number
      reasoningTokens: number
      responseTokens: number
      totalTokens: number
    }
    reasoning?: {
      initialThoughts: string
      criticalReview: string
      finalRefinement: string
    }
    queryAnalysis?: {
      originalQuery: string
      rewrittenQuery: string
      queryType: string
      complexity: "simple" | "moderate" | "complex"
      requiresHyDE: boolean
      requiresStepBack: boolean
      alternativeQueries: string[]
      hasHypotheticalAnswer: boolean
      hasStepBackQuestion: boolean
      confidence: number
    }
  }
}

interface ChatInterfaceProps {
  messages: Message[]
  onSendMessage: (content: string, options?: {
    showThinking?: boolean,
    complexityLevel?: 'simple' | 'normal' | 'complex',
    useContext?: boolean,
    documentIds?: string[]
  }) => void
  onAddMessage?: (message: Message) => void
  onClearChat: () => void
  onNewSession: () => void
  isProcessing: boolean
  disabled: boolean
  ragEngine?: unknown // Add ragEngine prop for diagnostics
  documentContext?: unknown
  aiClient?: unknown
  embeddingStatus?: {
    active: boolean
    stage: "idle" | "embedding" | "indexing"
    documentName: string
    completed: number
    total: number
    textPreview: string
    startedAt: number | null
  }
}

const SUGGESTED_QUESTIONS = [
  "Give me a concise executive summary of this document.",
  "List the top five key insights with brief explanations.",
  "Explain the methodology used and its significance.",
  "What limitations or open questions are highlighted?",
  "Create a timeline of major events or milestones discussed.",
  "Identify and define all acronyms found in the text.",
]

// Component to parse and render message content with thinking sections
function MessageContent({ content }: { content: string }) {
  const [expandedThinking, setExpandedThinking] = useState<{[key: string]: boolean}>({})

  // Parse content to extract thinking sections
  const parseContent = (text: string) => {
    const parts = []
    let currentIndex = 0
    let thinkingCounter = 0

    // Replace newlines with a placeholder to simulate the 's' flag behavior
    const processedText = text.replace(/\n/g, '\n')
    
    // Regex to match <think> or <thinking> tags (compatible with older JS)
    const thinkingRegex = /<think(?:ing)?>([\s\S]*?)<\/think(?:ing)?>/g
    let match

    while ((match = thinkingRegex.exec(processedText)) !== null) {
      // Add text before thinking section
      if (match.index > currentIndex) {
        const beforeText = processedText.slice(currentIndex, match.index).trim()
        if (beforeText) {
          parts.push({
            type: 'text',
            content: beforeText,
            id: `text-${parts.length}`
          })
        }
      }

      // Add thinking section
      const thinkingContent = match[1].trim()
      if (thinkingContent) {
        thinkingCounter++
        parts.push({
          type: 'thinking',
          content: thinkingContent,
          id: `thinking-${thinkingCounter}`
        })
      }

      currentIndex = match.index + match[0].length
    }

    // Add remaining text after last thinking section
    if (currentIndex < processedText.length) {
      const remainingText = processedText.slice(currentIndex).trim()
      if (remainingText) {
        parts.push({
          type: 'text',
          content: remainingText,
          id: `text-${parts.length}`
        })
      }
    }

    // If no thinking sections found, return original text
    if (parts.length === 0) {
      parts.push({
        type: 'text',
        content: text,
        id: 'text-0'
      })
    }

    return parts
  }

  const toggleThinking = (id: string) => {
    setExpandedThinking(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  const parts = parseContent(content)

  return (
    <div className="space-y-3">
      {parts.map((part) => {
        if (part.type === 'thinking') {
          const isExpanded = expandedThinking[part.id] || false
          
          return (
            <Collapsible
              key={part.id}
              open={isExpanded}
              onOpenChange={() => toggleThinking(part.id)}
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-between text-left h-7 px-2 py-1 text-xs bg-amber-50 border-amber-200 hover:bg-amber-100 text-amber-800 font-medium"
                >
                  <div className="flex items-center space-x-1.5">
                    <Brain className="w-3 h-3" />
                    <span>Thinking</span>
                    <Badge variant="outline" className="text-xs px-1 py-0 h-3.5 border-amber-300 text-amber-700">
                      {part.content.length > 1000 ? `${Math.round(part.content.length / 100) / 10}k` : `${part.content.length}c`}
                    </Badge>
                  </div>
                  {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </Button>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <Card className="mt-2 border border-amber-200 bg-amber-50/50">
                  <CardContent className="p-3">
                    <div className="flex items-center space-x-2 mb-2">
                      <Eye className="w-3 h-3 text-amber-600" />
                      <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                        Internal Reasoning
                      </span>
                    </div>
                    <div className="text-sm text-amber-900 whitespace-pre-wrap leading-relaxed bg-white/60 p-3 rounded border border-amber-200/50 font-mono">
                      {part.content}
                    </div>
                  </CardContent>
                </Card>
              </CollapsibleContent>
            </Collapsible>
          )
        } else {
          return (
            <div key={part.id} className="markdown-content">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex as unknown]}
                components={{
                  // Custom styling for markdown elements
                  h1: ({ children }) => <h1 className="text-lg sm:text-xl md:text-2xl font-bold mb-3 sm:mb-4 mt-4 sm:mt-6 first:mt-0 break-words">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-base sm:text-lg md:text-xl font-bold mb-2 sm:mb-3 mt-3 sm:mt-5 first:mt-0 break-words">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-sm sm:text-base md:text-lg font-bold mb-2 mt-3 sm:mt-4 first:mt-0 break-words">{children}</h3>,
                  h4: ({ children }) => <h4 className="text-xs sm:text-sm md:text-base font-bold mb-2 mt-2 sm:mt-3 first:mt-0 break-words">{children}</h4>,
                  h5: ({ children }) => <h5 className="text-xs sm:text-sm font-bold mb-2 mt-2 sm:mt-3 first:mt-0 break-words">{children}</h5>,
                  h6: ({ children }) => <h6 className="text-xs sm:text-sm font-bold mb-2 mt-2 sm:mt-3 first:mt-0 break-words">{children}</h6>,
                  p: ({ children }) => <p className="mb-3 sm:mb-4 last:mb-0 leading-relaxed text-xs sm:text-sm md:text-base break-words">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc list-inside mb-3 sm:mb-4 space-y-1 text-xs sm:text-sm">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside mb-3 sm:mb-4 space-y-1 text-xs sm:text-sm">{children}</ol>,
                  li: ({ children }) => <li className="leading-relaxed break-words">{children}</li>,
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-gray-300 pl-3 sm:pl-4 my-3 sm:my-4 italic text-gray-700 bg-gray-50 py-2 text-xs sm:text-sm">
                      {children}
                    </blockquote>
                  ),
                  code: (props: unknown) => {
                    const { inline, children, ...rest } = props;
                    const className: unknown = (props as unknown).className || ''
                    const langMatch = /language-(\w+)/.exec(className)
                    const language = langMatch ? langMatch[1] : undefined
                    const codeString = String(children).trim()

                    if (!inline && language === 'mermaid') {
                      return <Mermaid chart={codeString} />
                    }

                    return inline ? (
                      <code className="bg-gray-100 px-1 sm:px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-mono text-gray-800 break-all" {...rest}>
                        {children}
                      </code>
                    ) : (
                      <code className="block bg-gray-100 p-2 sm:p-3 rounded text-[10px] sm:text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words" {...rest}>
                        {children}
                      </code>
                    );
                  },
                  pre: ({ children }) => (
                    <pre className="bg-gray-100 p-2 sm:p-3 rounded text-[10px] sm:text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words mb-3 sm:mb-4">
                      {children}
                    </pre>
                  ),
                  table: ({ children }) => (
                    <div className="overflow-x-auto mb-3 sm:mb-4">
                      <table className="min-w-full border-collapse border border-gray-300 bg-white text-xs sm:text-sm">
                        {children}
                      </table>
                    </div>
                  ),
                  thead: ({ children }) => (
                    <thead className="bg-gray-50">
                      {children}
                    </thead>
                  ),
                  tbody: ({ children }) => <tbody>{children}</tbody>,
                  tr: ({ children }) => <tr className="border-b border-gray-200">{children}</tr>,
                  th: ({ children }) => (
                    <th className="border border-gray-300 px-2 sm:px-3 md:px-4 py-1 sm:py-2 text-left font-semibold text-gray-900 bg-gray-50 text-[10px] sm:text-xs">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="border border-gray-300 px-2 sm:px-3 md:px-4 py-1 sm:py-2 text-gray-700 text-[10px] sm:text-xs break-words">
                      {children}
                    </td>
                  ),
                  strong: ({ children }) => <strong className="font-bold text-gray-900">{children}</strong>,
                  em: ({ children }) => <em className="italic">{children}</em>,
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      className="text-blue-600 hover:text-blue-800 underline text-xs sm:text-sm break-all"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {children}
                    </a>
                  ),
                  hr: () => <hr className="my-4 sm:my-6 border-t-2 border-gray-200" />,
                } as Components}
            >
              {part.content}
              </ReactMarkdown>
            </div>
          )
        }
      })}
    </div>
  )
}

// Local Stepper function removed - using imported Stepper component instead

export function ChatInterface({ 
  messages, 
  onSendMessage, 
  onClearChat, 
  onNewSession, 
  isProcessing, 
  disabled, 
  ragEngine,
  embeddingStatus,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("")
  const [showAdvancedControls, setShowAdvancedControls] = useState(false)
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false)
  const [enhancedOptions, setEnhancedOptions] = useState({
    showThinking: false,
    complexityLevel: 'auto' as 'auto' | 'simple' | 'normal' | 'complex'
  })
  // Search mode: smart detection (no explicit controls)
  const [useContext, setUseContext] = useState(true)
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([])
  const [, setPdfViewerOpen] = useState(false)
  const [, setViewingDocument] = useState<{id: string, page: number} | null>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  const EMBEDDING_FUN_LINES = [
    "Hold up... chef is aligning vectors just right.",
    "Spicing chunks with cosine seasoning.",
    "Embedding engine is in the kitchen. No raw chunks served.",
    "Calibrating the brain juice. Almost there.",
    "One more stir and these chunks become searchable."
  ]

  const { documents: storeDocuments } = useAppStore()
  
  // Get documents for filter
  const filterDocuments = (storeDocuments || []).map(doc => ({
    id: doc.id,
    name: doc.name
  }))

  const handleViewPage = (documentId: string, page: number) => {
    setViewingDocument({ id: documentId, page })
    setPdfViewerOpen(true)
    const docName = storeDocuments.find(d => d.id === documentId)?.name || 'document'
    toast({
      title: "PDF Viewer",
      description: `Opening ${docName} at page ${page}`,
    })
  }

  const handleSelectQuery = (query: string) => {
    if (inputRef.current) {
      inputRef.current.value = query
      setInput(query)
      inputRef.current.focus()
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto"
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`
    }
  }, [input])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmitStreaming(e as unknown)
    }
  }

  const handleSuggestedQuestion = (question: string) => {
    if (!isProcessing && !disabled) {
      const options = enhancedOptions.complexityLevel === 'auto' 
        ? { showThinking: enhancedOptions.showThinking, useContext }
        : { 
            showThinking: enhancedOptions.showThinking,
            complexityLevel: enhancedOptions.complexityLevel as 'simple' | 'normal' | 'complex',
            useContext
          }
      
      onSendMessage(question, options)
    }
  }


  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  const formatResponseTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  const normalizeCitationToken = (value: string) =>
    value.toLowerCase().replace(/\s+/g, "").replace(/[.,[\]()"']/g, "")

  const getCitationAlignedChunks = (message: Message): RetrievedChunk[] => {
    const chunks = message.metadata?.retrievedChunks || []
    if (!chunks.length || message.role !== "assistant") return chunks

    const cited = Array.from(message.content.matchAll(/\[([^\]]+)\]/g))
      .map((m) => m[1]?.split(",")[0]?.trim())
      .filter(Boolean)
      .map((name) => normalizeCitationToken(name))

    if (!cited.length) return chunks

    const matched = chunks.filter((chunk) => {
      const source = normalizeCitationToken(chunk.source || "")
      const doc = normalizeCitationToken(chunk.documentName || "")
      return cited.some((c) => source.includes(c) || doc.includes(c) || c.includes(doc))
    })

    return matched.length > 0 ? matched : chunks
  }

  const renderEmbeddingStatusCard = (variant: "inline" | "spotlight" = "inline") => {
    if (!embeddingStatus?.active) return null

    const isSpotlight = variant === "spotlight"
    const totalChunks = Math.max(embeddingStatus.total || 1, 1)
    const completedChunks = Math.max(0, Math.min(embeddingStatus.completed || 0, totalChunks))
    const progressPercent = Math.min(100, Math.max(6, Math.round((completedChunks / totalChunks) * 100)))
    const currentChunk = embeddingStatus.stage === "embedding"
      ? Math.min(completedChunks + 1, totalChunks)
      : completedChunks
    const funLineIndex = Math.min(
      EMBEDDING_FUN_LINES.length - 1,
      Math.floor(completedChunks / 20),
    )

    return (
      <Card
        className={`border-2 border-black ${
          isSpotlight
            ? "bg-amber-100 shadow-[0_12px_24px_rgba(0,0,0,0.12)]"
            : "bg-amber-50"
        }`}
      >
        <CardContent className={`space-y-2 ${isSpotlight ? "p-4 sm:p-5" : "p-3"}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-500 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-orange-600" />
              </span>
              <p className={`${isSpotlight ? "text-base sm:text-lg" : "text-sm"} font-semibold`}>
                {embeddingStatus.stage === "indexing"
                  ? "Plating finished vectors into the database..."
                  : "Hold up, cooking embeddings..."}
              </p>
            </div>
            <Badge variant="outline" className="text-xs border-black">
              {completedChunks}/{totalChunks}
            </Badge>
          </div>

          <div className="h-2 rounded-full bg-black/10 overflow-hidden">
            <div
              className="h-full bg-black transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <p className="text-xs text-gray-700">
            {embeddingStatus.stage === "embedding"
              ? `Embedding chunk ${currentChunk}/${totalChunks}...`
              : "Indexing complete chunks for retrieval..."}
          </p>

          <p className="text-xs text-gray-600 italic">{EMBEDDING_FUN_LINES[funLineIndex]}</p>

          {embeddingStatus.textPreview && (
            <p className="text-[11px] text-gray-500 truncate">
              Now seasoning: &quot;{embeddingStatus.textPreview}&quot;
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  const showEmbeddingSpotlight = Boolean(embeddingStatus?.active && messages.length === 0)
  const showEmbeddingInline = Boolean(embeddingStatus?.active && messages.length > 0)

  const runDiagnostics = async () => {
    if (!ragEngine) {
      console.error("RAG Engine not available for diagnostics")
      return
    }

    setIsRunningDiagnostics(true)
    try {
      logger.debug("🔍 Running system diagnostics...")
      const diagnostics = await ragEngine.runDiagnostics()
      
      // Create a diagnostic report message
      const diagnosticReport = `# 🔍 System Diagnostic Report

## System Status
- **Initialized:** ${diagnostics.systemStatus.initialized ? '✅ Yes' : '❌ No'}
- **AI Client:** ${diagnostics.systemStatus.aiClientAvailable ? '✅ Available' : '❌ Not Available'}
- **Provider:** ${diagnostics.systemStatus.currentProvider || 'Not Set'}
- **Model:** ${diagnostics.systemStatus.currentModel || 'Not Set'}
- **Documents:** ${diagnostics.systemStatus.documentsCount}
- **Total Chunks:** ${diagnostics.systemStatus.totalChunks}
- **Total Embeddings:** ${diagnostics.systemStatus.totalEmbeddings}

## Document Analysis
${diagnostics.documents.length === 0 
  ? '❌ No documents found' 
  : diagnostics.documents.map((doc: unknown, i: number) => 
    `**${i + 1}. ${doc.name}**
- Chunks: ${doc.chunksCount}
- Embeddings: ${doc.embeddingsCount}
- Valid Structure: ${doc.hasValidStructure ? '✅' : '❌'}
- Embedding Dimension: ${doc.embeddingDimension}
- Preview: ${doc.firstChunkPreview}`
  ).join('\n\n')
}

## Tests
**Embedding Generation:** ${diagnostics.embeddingTest ? 
  (diagnostics.embeddingTest.success ? 
    `✅ Success (${diagnostics.embeddingTest.dimensions} dimensions)` : 
    `❌ Failed: ${diagnostics.embeddingTest.error}`
  ) : '⏸️ Not Tested'}

**Similarity Calculation:** ${diagnostics.similarityTest ? 
  (diagnostics.similarityTest.success ? 
    `✅ Success (Score: ${diagnostics.similarityTest.similarity?.toFixed(3)})` : 
    '❌ Failed'
  ) : '⏸️ Not Tested'}

---
*Diagnostic completed at ${new Date().toLocaleString()}*`

      // Add diagnostic message to chat

      // This would need to be passed up to the parent component
      // For now, just log the results
      logger.debug("Diagnostic report generated:", diagnosticReport)
      
    } catch (error) {
      console.error("Diagnostic failed:", error)
    } finally {
      setIsRunningDiagnostics(false)
    }
  }

  // Enhanced streaming chat submit handler (Docs-only)
  const handleSubmitStreaming = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = (input || "").trim()
    if (!text) return
    // Docs-only: delegate to parent and reset input
    setInput("")
    onSendMessage(text, {
      useContext,
      showThinking: enhancedOptions.showThinking,
      complexityLevel: enhancedOptions.complexityLevel === 'auto' ? undefined : (enhancedOptions.complexityLevel as unknown),
      documentIds: selectedDocumentIds.length > 0 ? selectedDocumentIds : undefined
    })
    
    // Add to query history
    if (typeof window !== 'undefined' && (window as unknown).__addQueryToHistory) {
      (window as unknown).__addQueryToHistory(text)
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-white">
      {/* Chat Header with Controls */}
      <div className="border-b border-gray-200 p-2 sm:p-3 md:p-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm sm:text-base md:text-lg font-semibold">Chat</h2>
          <div className="flex items-center space-x-1 sm:space-x-2 flex-wrap">
            {/* Query History */}
            <QueryHistory onSelectQuery={handleSelectQuery} />
            
            {/* Settings */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAdvancedControls(!showAdvancedControls)}
                    className={`${showAdvancedControls ? "bg-purple-50 text-purple-700" : ""} h-7 sm:h-8 w-7 sm:w-8 p-0`}
                  >
                    <Settings className="w-3 h-3 sm:w-4 sm:h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Enhanced AI Controls</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          <QuickActions
            onClearChat={onClearChat}
            onNewSession={onNewSession}
              disabled={disabled}
          />
        </div>
        </div>

        {/* Enhanced Controls */}
        {showAdvancedControls && (
          <Card className="mt-3 border border-purple-200 bg-purple-50/50">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-purple-800 flex items-center">
                  <Brain className="w-4 h-4 mr-1" />
                  Enhanced AI Settings
                </h3>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-4 h-4 text-purple-600" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-sm">
                        <strong>Thinking Mode:</strong> Shows AI&apos;s reasoning process<br/>
                        <strong>Complexity:</strong> Controls analysis depth<br/>
                        • Simple: Fast, direct answers<br/>
                        • Normal: Balanced analysis<br/>
                        • Complex: Deep reasoning with validation
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center justify-between space-x-3 p-2 rounded-md border border-purple-200 bg-purple-50/50">
                  <Label htmlFor="thinking-mode" className="text-sm font-medium cursor-pointer">
                    Show Thinking Process
                  </Label>
                  <div className="flex items-center space-x-2">
                    <span className={`text-xs font-medium ${enhancedOptions.showThinking ? 'text-green-600' : 'text-gray-500'}`}>
                      {enhancedOptions.showThinking ? 'ON' : 'OFF'}
                    </span>
                    <Switch
                      id="thinking-mode"
                      checked={enhancedOptions.showThinking}
                      onCheckedChange={(checked) => 
                        setEnhancedOptions(prev => ({ ...prev, showThinking: checked }))
                      }
                    />
                  </div>
                </div>
                
                <div className="flex items-center space-x-2 p-2 rounded-md border border-purple-200 bg-purple-50/50">
                  <Label htmlFor="complexity-level" className="text-sm font-medium whitespace-nowrap">
                    Analysis Level:
                  </Label>
                  <Select
                    value={enhancedOptions.complexityLevel}
                    onValueChange={(value) => 
                      setEnhancedOptions(prev => ({ 
                        ...prev, 
                        complexityLevel: value as 'auto' | 'simple' | 'normal' | 'complex'
                      }))
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto-detect</SelectItem>
                      <SelectItem value="simple">Simple</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="complex">Complex</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between space-x-3 p-2 rounded-md border border-purple-200 bg-purple-50/50">
                  <Label htmlFor="context-toggle" className="text-sm font-medium cursor-pointer">
                    Use Document Context
                  </Label>
                  <div className="flex items-center space-x-2">
                    <span className={`text-xs font-medium ${useContext ? 'text-green-600' : 'text-gray-500'}`}>
                      {useContext ? 'ON' : 'OFF'}
                    </span>
                    <Switch
                      id="context-toggle"
                      checked={useContext}
                      onCheckedChange={(checked) => setUseContext(checked)}
                    />
                  </div>
                </div>
              </div>
              
              {enhancedOptions.showThinking && (
                <div className="mt-2 text-xs text-purple-700 bg-purple-100 p-2 rounded">
                  <Brain className="w-3 h-3 inline mr-1" />
                  Thinking mode enabled - AI will show its reasoning process
                </div>
              )}
              
              {/* Diagnostic Button */}
              <div className="mt-3 pt-3 border-t border-purple-200">
                <Button
                  onClick={runDiagnostics}
                  disabled={isRunningDiagnostics || !ragEngine}
                  variant="outline"
                  size="sm"
                  className="w-full text-xs border-purple-300 text-purple-700 hover:bg-purple-100"
                >
                  {isRunningDiagnostics ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Running Diagnostics...
                    </>
                  ) : (
                    <>
                      <HelpCircle className="w-3 h-3 mr-1" />
                      Run System Diagnostics
                    </>
                  )}
                </Button>
                <p className="text-xs text-purple-600 mt-1 text-center">
                  Check document processing & retrieval
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      
      {/* Skip to content link for accessibility */}
      <a href="#chat-messages" className="skip-to-content">
        Skip to chat messages
      </a>

      {showEmbeddingInline && (
        <div className="max-w-4xl mx-auto w-full px-4 pt-3">
          {renderEmbeddingStatusCard("inline")}
        </div>
      )}

      {/* Messages Area */}
      <ScrollArea className="flex-1 h-0 px-4 sm:px-6 lg:px-8" ref={scrollAreaRef}>
        <div id="chat-messages" className="max-w-4xl mx-auto py-6 space-content-lg">
          {messages.length === 0 ? (
            showEmbeddingSpotlight ? (
              <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-full max-w-3xl px-4">
                  {renderEmbeddingStatusCard("spotlight")}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center space-y-8 max-w-2xl px-4">
                  <div className="w-24 h-24 border-4 border-black mx-auto flex items-center justify-center bg-gray-50 card-enhanced">
                    <Brain className="w-12 h-12" />
                  </div>

                  <div className="space-y-4">
                    <h1 className="text-hierarchy-1">QUANTUM PDF READY</h1>
                    <p className="text-lg text-gray-600 leading-relaxed">
                      {disabled
                        ? "Configure AI Providers and Upload PDFs to start chatting"
                        : "Ask questions about your uploaded documents"}
                    </p>
                  </div>

                  {!disabled && (
                    <div className="space-y-6">
                      <h2 className="text-hierarchy-3 text-gray-800">SUGGESTED QUESTIONS:</h2>
                      <div className="grid gap-3 max-w-xl mx-auto">
                        {SUGGESTED_QUESTIONS.map((question, index) => (
                          <button
                            key={index}
                            onClick={() => handleSuggestedQuestion(question)}
                            className="p-4 text-left border-2 border-gray-300 hover:border-black hover:bg-gray-50 transition-all duration-200 text-sm group btn-enhanced"
                            disabled={isProcessing}
                            aria-label={`Ask: ${question}`}
                          >
                            <div className="flex items-start space-x-3">
                              <Sparkles className="w-4 h-4 mt-0.5 text-gray-500 group-hover:text-black transition-colors" />
                              <span className="leading-relaxed">{question}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-8 text-sm text-gray-500">
                    <div className="text-center space-y-2">
                      <MessageSquare className="w-8 h-8 mx-auto" />
                      <p className="font-medium">Multi-document chat</p>
                    </div>
                    <div className="text-center space-y-2">
                      <Brain className="w-8 h-8 mx-auto" />
                      <p className="font-medium">AI-powered analysis</p>
                    </div>
                    <div className="text-center space-y-2">
                      <FileText className="w-8 h-8 mx-auto" />
                      <p className="font-medium">Source citations</p>
                    </div>
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="space-y-8">
              {messages.map((message) => (
                <div key={message.id} className="space-y-4 min-w-0" role="article" aria-label={`${message.role} message`}>
                  {/* Message Header */}
                  <div className="flex items-start justify-between flex-wrap gap-2 min-w-0">
                    <div className="flex items-center space-x-4">
                      <Badge
                        variant="outline"
                        className={`border-2 font-bold px-3 py-1 ${
                          message.role === "user" ? "border-black bg-black text-white" : "border-gray-400 text-gray-700"
                        }`}
                      >
                        {message.role === "user" ? "USER" : "ASSISTANT"}
                      </Badge>
                      <time className="text-sm text-gray-500 font-mono" dateTime={message.timestamp.toISOString()}>
                        {formatTimestamp(message.timestamp)}
                      </time>
                    </div>

                    {message.metadata && (
                      <div className="flex items-center justify-end gap-2 flex-wrap max-w-full">
                        {message.metadata.responseTime !== undefined && (
                          <Badge variant="outline" className="text-xs border-gray-300">
                            <Clock className="w-3 h-3 mr-1" />
                            {formatResponseTime(message.metadata.responseTime)}
                          </Badge>
                        )}
                        {message.metadata.relevanceScore !== undefined && (
                          <Badge variant="outline" className="text-xs border-gray-300">
                            <Target className="w-3 h-3 mr-1" />
                            {(message.metadata.relevanceScore * 100).toFixed(1)}%
                          </Badge>
                        )}
                        {message.metadata.qualityMetrics && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs cursor-help ${
                                    message.metadata.qualityMetrics.finalRating >= 85 
                                      ? 'border-green-500 text-green-700 bg-green-50' 
                                      : message.metadata.qualityMetrics.finalRating >= 70
                                      ? 'border-yellow-500 text-yellow-700 bg-yellow-50'
                                      : 'border-red-500 text-red-700 bg-red-50'
                                  }`}
                                >
                                  <Sparkles className="w-3 h-3 mr-1" />
                                  Q: {message.metadata.qualityMetrics.finalRating.toFixed(0)}%
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <div className="text-sm space-y-1">
                                  <div className="font-semibold mb-2">Response Quality Breakdown:</div>
                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>Accuracy: {message.metadata.qualityMetrics.accuracyScore}%</div>
                                    <div>Completeness: {message.metadata.qualityMetrics.completenessScore}%</div>
                                    <div>Clarity: {message.metadata.qualityMetrics.clarityScore}%</div>
                                    <div>Confidence: {message.metadata.qualityMetrics.confidenceScore}%</div>
                                  </div>
                                  <div className="text-xs text-gray-600 mt-2">
                                    Overall Rating: {message.metadata.qualityMetrics.finalRating.toFixed(1)}%
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {message.metadata.tokenUsage && (
                          <Badge variant="outline" className="text-xs border-gray-300">
                            <Zap className="w-3 h-3 mr-1" />
                            {message.metadata.tokenUsage.totalTokens}t
                          </Badge>
                        )}
                        {message.metadata.reasoning && (
                          <Badge variant="outline" className="text-xs border-purple-300 text-purple-700 bg-purple-50">
                            <Brain className="w-3 h-3 mr-1" />
                            Enhanced
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Message Content */}
                  <div
                    className={`message-bubble ${message.role === "user" ? "message-bubble-user" : "message-bubble-assistant"} group`}
                  >
                    <div className="flex flex-col gap-4">
                      {/* Collapsible Thinking Bubble for assistant messages */}
                      {message.role === "assistant" && message.metadata?.reasoning && enhancedOptions.showThinking && (
                        <ThinkingBubble
                          reasoning={message.metadata.reasoning}
                          responseTime={message.metadata.responseTime}
                        />
                      )}
                    <div className="flex justify-between items-start gap-4 min-w-0">
                      <div className="flex-1 min-w-0">
                          <MessageContent
                            content={(() => {
                              if (message.role !== "assistant") return message.content
                              let cleaned = message.content
                                .replace(/<think(?:ing)?>([\s\S]*?)<\/think(?:ing)?>/gi, "")

                              // Remove any reasoning block starting with AI Reasoning Process up to Response heading
                              cleaned = cleaned.replace(/^[\s\S]*?AI Reasoning Process[\s\S]*?Response\s*/i, "")
                              // Fallback: if still contains Final Enhancement before Response, trim again
                              cleaned = cleaned.replace(/^[\s\S]*?Final Enhancement[\s\S]*?Response\s*/i, "")

                              return cleaned.trim()
                            })()}
                          />
                      </div>
                    </div>

                    {/* Chunk Visualization */}
                    {message.metadata?.retrievedChunks && message.metadata.retrievedChunks.length > 0 && (
                      <ChunkVisualization
                        chunks={getCitationAlignedChunks(message)}
                        onViewPage={handleViewPage}
                      />
                    )}

                    {message.role === "assistant" && message.metadata?.queryAnalysis && (
                      <Collapsible>
                        <CollapsibleTrigger asChild>
                          <Button variant="outline" size="sm" className="justify-between w-full text-xs">
                            <span className="flex items-center gap-2">
                              <Brain className="w-3 h-3" />
                              Query Breakdown
                            </span>
                            <ChevronDown className="w-3 h-3" />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-2">
                          <div className="border rounded-md p-3 bg-gray-50 text-xs space-y-3">
                            <div className="space-y-1">
                              <p className="font-semibold text-gray-700">Rewritten Query</p>
                              <p className="text-gray-800 break-words">{message.metadata.queryAnalysis.rewrittenQuery}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline">{message.metadata.queryAnalysis.queryType}</Badge>
                              <Badge variant="outline">{message.metadata.queryAnalysis.complexity}</Badge>
                              <Badge variant="outline">
                                Confidence {Math.round((message.metadata.queryAnalysis.confidence || 0) * 100)}%
                              </Badge>
                              <Badge variant={message.metadata.queryAnalysis.requiresHyDE ? "default" : "outline"}>
                                HyDE {message.metadata.queryAnalysis.requiresHyDE ? "ON" : "OFF"}
                              </Badge>
                              <Badge variant={message.metadata.queryAnalysis.requiresStepBack ? "default" : "outline"}>
                                Step-back {message.metadata.queryAnalysis.requiresStepBack ? "ON" : "OFF"}
                              </Badge>
                            </div>
                            {message.metadata.queryAnalysis.alternativeQueries?.length > 0 && (
                              <div className="space-y-1">
                                <p className="font-semibold text-gray-700">Alternative Queries</p>
                                <ul className="list-disc pl-4 space-y-1 text-gray-700">
                                  {message.metadata.queryAnalysis.alternativeQueries.slice(0, 3).map((query, idx) => (
                                    <li key={`${message.id}-query-alt-${idx}`} className="break-words">{query}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                    </div>
                  </div>
                </div>
              ))}

              {isProcessing && <EnhancedChatProcessingSkeleton phase="retrieving" />}

              <div ref={messagesEndRef} />
      </div>
      )}
      </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t-2 border-black bg-white sticky bottom-0 z-10">
        <div className="max-w-4xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8 py-2 sm:py-4 md:py-6">
          {/* Document Filter */}
          {filterDocuments.length > 0 && (
            <div className="mb-3">
              <DocumentFilter
                documents={filterDocuments}
                selectedDocumentIds={selectedDocumentIds}
                onSelectionChange={setSelectedDocumentIds}
              />
            </div>
          )}

          <form onSubmit={handleSubmitStreaming} className="space-y-4 form-enhanced">
            {/* Search mode removed */}

            {/* Search URL guidance removed */}

            <div className="flex items-end gap-2 w-full">
              {/* Mode selector removed (Docs-only) */}

              {/* Output mode selector removed */}

              {/* Text input */}
              <div className="flex-1 min-w-0">
                <Textarea
                  id="chat-input"
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={disabled ? 'Configure AI provider and upload documents to start chatting...' : 'Ask a question about your documents... (Shift+Enter for new line)'}
                  disabled={disabled || isProcessing}
                  className="min-h-10 h-10 sm:min-h-12 sm:h-12 max-h-[120px] resize-none border-2 border-black focus:ring-0 focus:border-black font-mono text-xs sm:text-sm md:text-base leading-relaxed w-full p-2 sm:p-3"
                  rows={1}
                />
              </div>

              {/* Submit button */}
              <div className="shrink-0">
                <Button
                  type="submit"
                  disabled={(disabled || isProcessing) || !input.trim()}
                  className="border-2 border-black bg-black text-white hover:bg-white hover:text-black px-2 sm:px-3 md:px-6 h-10 sm:h-12 btn-enhanced"
                  aria-label={'Send message'}
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                  )}
                </Button>
              </div>
            </div>

            {/* Search badges removed */}

            {!disabled && (
              <div className="text-center text-xs sm:text-sm text-gray-500 space-y-1 mt-2">
                <p>
                  pls star the{' '}
                  <a href="https://github.com/Kedhareswer/QuantumPDF_ChatApp" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700 underline">repo</a>{' '}if you liked it
                </p>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
