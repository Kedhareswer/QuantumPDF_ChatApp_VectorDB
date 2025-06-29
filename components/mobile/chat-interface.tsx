"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import {
  Send,
  Loader2,
  FileText,
  Brain,
  Clock,
  Target,
  Sparkles,
  MessageSquare,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Trash2,
  RotateCcw,
  Download,
  Share,
  ChevronDown,
  ChevronRight,
  Eye,
  Zap,
  Settings,
  HelpCircle,
  Menu,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { QuickActions } from "@/components/quick-actions"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  sources?: string[]
  metadata?: {
    responseTime?: number
    relevanceScore?: number
    retrievedChunks?: number
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
  }
}

interface ChatInterfaceProps {
  messages: Message[]
  onSendMessage: (content: string, options?: {
    showThinking?: boolean,
    complexityLevel?: 'simple' | 'normal' | 'complex'
  }) => void
  onClearChat: () => void
  onNewSession: () => void
  isProcessing: boolean
  disabled: boolean
  ragEngine?: any
}

const SUGGESTED_QUESTIONS = [
  "What are the main topics covered in the documents?",
  "Can you summarize the key findings?",
  "What are the most important conclusions?",
  "How do the documents relate to each other?",
]

// Mobile-optimized MessageContent component (same logic, mobile styling)
function MessageContent({ content }: { content: string }) {
  const [expandedThinking, setExpandedThinking] = useState<{[key: string]: boolean}>({})

  const parseContent = (text: string) => {
    const parts = []
    let currentIndex = 0
    let thinkingCounter = 0

    const processedText = text.replace(/\n/g, '\n')
    const thinkingRegex = /<think(?:ing)?>([\s\S]*?)<\/think(?:ing)?>/g
    let match

    while ((match = thinkingRegex.exec(processedText)) !== null) {
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
    <div className="space-y-2">
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
                  className="w-full justify-between text-left h-8 px-3 py-1 text-sm bg-amber-50 border-amber-200 hover:bg-amber-100 text-amber-800 font-medium"
                >
                  <div className="flex items-center space-x-2">
                    <Brain className="w-3 h-3" />
                    <span>Thinking</span>
                    <Badge variant="outline" className="text-xs px-1 py-0 h-4 border-amber-300 text-amber-700">
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
                    <div className="text-sm text-amber-900 whitespace-pre-wrap leading-relaxed bg-white/60 p-2 rounded border border-amber-200/50 font-mono">
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
                remarkPlugins={[remarkGfm]}
                components={{
                  // Mobile-optimized markdown styling
                  h1: ({ children }) => <h1 className="text-xl font-bold mb-3 mt-4 first:mt-0">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-lg font-bold mb-2 mt-3 first:mt-0">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h3>,
                  h4: ({ children }) => <h4 className="text-sm font-bold mb-2 mt-2 first:mt-0">{children}</h4>,
                  h5: ({ children }) => <h5 className="text-sm font-bold mb-1 mt-2 first:mt-0">{children}</h5>,
                  h6: ({ children }) => <h6 className="text-sm font-bold mb-1 mt-2 first:mt-0">{children}</h6>,
                  p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed text-sm">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1 text-sm">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1 text-sm">{children}</ol>,
                  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-3 border-gray-300 pl-3 my-3 italic text-gray-700 bg-gray-50 py-2 text-sm">
                      {children}
                    </blockquote>
                  ),
                  code: (props: any) => {
                    const { inline, children, ...rest } = props;
                    return inline ? (
                      <code className="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono text-gray-800" {...rest}>
                        {children}
                      </code>
                    ) : (
                      <code className="block bg-gray-100 p-2 rounded text-xs font-mono overflow-x-auto" {...rest}>
                        {children}
                      </code>
                    );
                  },
                  pre: ({ children }) => (
                    <pre className="bg-gray-100 p-2 rounded text-xs font-mono overflow-x-auto mb-3">
                      {children}
                    </pre>
                  ),
                  table: ({ children }) => (
                    <div className="overflow-x-auto mb-3">
                      <table className="min-w-full border-collapse border border-gray-300 bg-white text-sm">
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
                    <th className="border border-gray-300 px-2 py-1 text-left font-semibold text-gray-900 bg-gray-50 text-xs">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="border border-gray-300 px-2 py-1 text-gray-700 text-xs">
                      {children}
                    </td>
                  ),
                  strong: ({ children }) => <strong className="font-bold text-gray-900">{children}</strong>,
                  em: ({ children }) => <em className="italic">{children}</em>,
                  a: ({ href, children }) => (
                    <a 
                      href={href} 
                      className="text-blue-600 hover:text-blue-800 underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {children}
                    </a>
                  ),
                  hr: () => <hr className="my-4 border-t-2 border-gray-200" />,
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

export function ChatInterface({ 
  messages, 
  onSendMessage, 
  onClearChat, 
  onNewSession, 
  isProcessing, 
  disabled, 
  ragEngine 
}: ChatInterfaceProps) {
  const [input, setInput] = useState("")
  const [isExpanded, setIsExpanded] = useState(false)
  const [showAdvancedControls, setShowAdvancedControls] = useState(false)
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false)
  const [enhancedOptions, setEnhancedOptions] = useState({
    showThinking: false,
    complexityLevel: 'auto' as 'auto' | 'simple' | 'normal' | 'complex'
  })
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto"
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 100)}px`
    }
  }, [input])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim() && !isProcessing && !disabled) {
      const options = enhancedOptions.complexityLevel === 'auto' 
        ? { showThinking: enhancedOptions.showThinking }
        : { 
            showThinking: enhancedOptions.showThinking,
            complexityLevel: enhancedOptions.complexityLevel as 'simple' | 'normal' | 'complex'
          }
      
      onSendMessage(input.trim(), options)
      setInput("")
      setIsExpanded(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const handleSuggestedQuestion = (question: string) => {
    if (!isProcessing && !disabled) {
      const options = enhancedOptions.complexityLevel === 'auto' 
        ? { showThinking: enhancedOptions.showThinking }
        : { 
            showThinking: enhancedOptions.showThinking,
            complexityLevel: enhancedOptions.complexityLevel as 'simple' | 'normal' | 'complex'
          }
      
      onSendMessage(question, options)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (err) {
      console.error("Failed to copy text: ", err)
    }
  }

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour12: true,
      hour: "numeric",
      minute: "2-digit",
    })
  }

  const formatResponseTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  const runDiagnostics = async () => {
    if (!ragEngine) {
      console.error("RAG Engine not available for diagnostics")
      return
    }

    setIsRunningDiagnostics(true)
    try {
      console.log("🔍 Running system diagnostics...")
      const diagnostics = await ragEngine.runDiagnostics()
      
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
  : diagnostics.documents.map((doc: any, i: number) => 
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

      console.log("Diagnostic report generated:", diagnosticReport)
      
    } catch (error) {
      console.error("Diagnostic failed:", error)
    } finally {
      setIsRunningDiagnostics(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Mobile Chat Header */}
      <div className="border-b border-gray-200 p-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Chat</h2>
          <div className="flex items-center space-x-1">
            {/* Mobile Settings Sheet */}
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                >
                  <Settings className="w-4 h-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80 p-4">
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-purple-800 flex items-center">
                    <Brain className="w-4 h-4 mr-2" />
                    Enhanced AI Settings
                  </h3>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="thinking-mode-mobile" className="text-sm">
                        Show Thinking Process
                      </Label>
                      <Switch
                        id="thinking-mode-mobile"
                        checked={enhancedOptions.showThinking}
                        onCheckedChange={(checked) => 
                          setEnhancedOptions(prev => ({ ...prev, showThinking: checked }))
                        }
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="complexity-level-mobile" className="text-sm">
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
                        <SelectTrigger className="h-8 text-sm">
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
                  </div>
                  
                  {enhancedOptions.showThinking && (
                    <div className="text-xs text-purple-700 bg-purple-100 p-2 rounded">
                      <Brain className="w-3 h-3 inline mr-1" />
                      Thinking mode enabled - AI will show its reasoning process
                    </div>
                  )}
                  
                  <div className="pt-3 border-t border-purple-200">
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
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            
            <QuickActions
              onClearChat={onClearChat}
              onNewSession={onNewSession}
              disabled={disabled}
            />
          </div>
        </div>
      </div>

      {/* Messages Area - Mobile Optimized */}
      <ScrollArea className="flex-1 px-3" ref={scrollAreaRef}>
        <div className="py-3 space-y-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center space-y-6 max-w-sm px-4">
                <div className="w-16 h-16 border-4 border-black mx-auto flex items-center justify-center bg-gray-50 rounded-lg">
                  <Brain className="w-8 h-8" />
                </div>

                <div className="space-y-3">
                  <h1 className="text-lg font-bold">QUANTUM PDF READY</h1>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {disabled
                      ? "Upload PDF documents and configure your AI provider to start chatting"
                      : "Ask questions about your uploaded documents"}
                  </p>
                </div>

                {!disabled && (
                  <div className="space-y-4">
                    <h2 className="text-sm font-bold text-gray-800">SUGGESTED QUESTIONS:</h2>
                    <div className="grid gap-2">
                      {SUGGESTED_QUESTIONS.map((question, index) => (
                        <button
                          key={index}
                          onClick={() => handleSuggestedQuestion(question)}
                          className="p-3 text-left border-2 border-gray-300 hover:border-black hover:bg-gray-50 transition-all duration-200 text-xs group rounded-lg"
                          disabled={isProcessing}
                        >
                          <div className="flex items-start space-x-2">
                            <Sparkles className="w-3 h-3 mt-0.5 text-gray-500 group-hover:text-black transition-colors flex-shrink-0" />
                            <span className="leading-relaxed">{question}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id} className="space-y-2">
                  {/* Mobile Message Header */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center space-x-2">
                      <Badge
                        variant="outline"
                        className={`border-2 font-bold px-2 py-1 text-xs ${
                          message.role === "user" ? "border-black bg-black text-white" : "border-gray-400 text-gray-700"
                        }`}
                      >
                        {message.role === "user" ? "USER" : "AI"}
                      </Badge>
                      <time className="text-xs text-gray-500 font-mono">
                        {formatTimestamp(message.timestamp)}
                      </time>
                    </div>

                    {message.metadata && (
                      <div className="flex items-center space-x-1 flex-wrap gap-1">
                        {message.metadata.responseTime && (
                          <Badge variant="outline" className="text-xs border-gray-300 px-1 py-0">
                            <Clock className="w-2 h-2 mr-1" />
                            {formatResponseTime(message.metadata.responseTime)}
                          </Badge>
                        )}
                        {message.metadata.qualityMetrics && (
                          <Badge 
                            variant="outline" 
                            className={`text-xs px-1 py-0 ${
                              message.metadata.qualityMetrics.finalRating >= 85 
                                ? 'border-green-500 text-green-700 bg-green-50' 
                                : message.metadata.qualityMetrics.finalRating >= 70
                                ? 'border-yellow-500 text-yellow-700 bg-yellow-50'
                                : 'border-red-500 text-red-700 bg-red-50'
                            }`}
                          >
                            <Sparkles className="w-2 h-2 mr-1" />
                            Q: {message.metadata.qualityMetrics.finalRating.toFixed(0)}%
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Mobile Message Content */}
                  <div
                    className={`rounded-lg p-3 ${
                      message.role === "user" 
                        ? "bg-black text-white ml-8" 
                        : "bg-gray-50 border border-gray-200 mr-2"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <MessageContent content={message.content} />
                      </div>

                      {/* Mobile Message Actions */}
                      <div className="flex items-center space-x-1 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(message.content)}
                          className={`h-6 w-6 p-0 ${
                            message.role === "user" 
                              ? "text-white hover:bg-white/20" 
                              : "text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>

                    {message.sources && message.sources.length > 0 && (
                      <Card className="mt-3 border border-gray-200 bg-white">
                        <CardContent className="p-2">
                          <div className="flex items-center space-x-1 mb-2">
                            <FileText className="w-3 h-3 text-gray-600" />
                            <span className="text-xs font-bold text-gray-700">SOURCES ({message.sources.length})</span>
                          </div>
                          <div className="space-y-1">
                            {message.sources.map((source, index) => (
                              <div
                                key={index}
                                className="text-xs bg-gray-50 p-2 border border-gray-200 font-mono rounded-sm"
                              >
                                <span className="text-gray-600 font-bold">#{index + 1}</span> {source}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              ))}

              {isProcessing && (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="border-gray-400 text-gray-700 font-bold px-2 py-1 text-xs">
                      AI
                    </Badge>
                    <time className="text-xs text-gray-500 font-mono">{formatTimestamp(new Date())}</time>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mr-2">
                    <div className="flex items-center space-x-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Analyzing documents...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Mobile Input Area */}
      <div className="border-t-2 border-black bg-white flex-shrink-0">
        <div className="p-3">
          <form onSubmit={handleSubmit} className="space-y-2">
            <div className="flex space-x-2">
              <div className="flex-1">
                <Textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    disabled
                      ? "Configure AI provider and upload documents to start chatting..."
                      : "Ask a question about your documents..."
                  }
                  disabled={disabled || isProcessing}
                  className="min-h-[2.5rem] max-h-[6rem] resize-none border-2 border-black focus:ring-0 focus:border-black text-sm leading-relaxed"
                  rows={1}
                />
              </div>
              <Button
                type="submit"
                disabled={disabled || isProcessing || !input.trim()}
                className="border-2 border-black bg-black text-white hover:bg-white hover:text-black px-3 h-10 self-end flex-shrink-0"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>

            {!disabled && (
              <div className="text-center text-xs text-gray-500">
                <p>
                  <span className="font-bold">TIP:</span> Ask specific questions for better results
                </p>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  )
} 