"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
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
  ragEngine?: any // Add ragEngine prop for diagnostics
}

const SUGGESTED_QUESTIONS = [
  "What are the main topics covered in the documents?",
  "Can you summarize the key findings?",
  "What are the most important conclusions?",
  "How do the documents relate to each other?",
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
            <div
              key={part.id}
              className="whitespace-pre-wrap leading-relaxed text-base"
            >
              {part.content}
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
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`
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

  const runDiagnostics = async () => {
    if (!ragEngine) {
      console.error("RAG Engine not available for diagnostics")
      return
    }

    setIsRunningDiagnostics(true)
    try {
      console.log("🔍 Running system diagnostics...")
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

      // Add diagnostic message to chat
      const diagnosticMessage = {
        id: Date.now().toString(),
        role: "assistant" as const,
        content: diagnosticReport,
        timestamp: new Date(),
        sources: ['System Diagnostics'],
        metadata: {
          responseTime: 0,
          relevanceScore: 1.0,
          retrievedChunks: 0,
        },
      }

      // This would need to be passed up to the parent component
      // For now, just log the results
      console.log("Diagnostic report generated:", diagnosticReport)
      
    } catch (error) {
      console.error("Diagnostic failed:", error)
    } finally {
      setIsRunningDiagnostics(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Chat Header with Controls */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Chat</h2>
          <div className="flex items-center space-x-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAdvancedControls(!showAdvancedControls)}
                    className={showAdvancedControls ? "bg-purple-50 text-purple-700" : ""}
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Enhanced AI Controls</p>
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
                        <strong>Thinking Mode:</strong> Shows AI's reasoning process<br/>
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
                <div className="flex items-center space-x-2">
                  <Switch
                    id="thinking-mode"
                    checked={enhancedOptions.showThinking}
                    onCheckedChange={(checked) => 
                      setEnhancedOptions(prev => ({ ...prev, showThinking: checked }))
                    }
                  />
                  <Label htmlFor="thinking-mode" className="text-sm">
                    Show Thinking Process
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Label htmlFor="complexity-level" className="text-sm whitespace-nowrap">
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

      {/* Messages Area */}
      <ScrollArea className="flex-1 px-4 sm:px-6 lg:px-8" ref={scrollAreaRef}>
        <div id="chat-messages" className="max-w-4xl mx-auto py-6 space-content-lg">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center space-y-8 max-w-2xl px-4">
                <div className="w-24 h-24 border-4 border-black mx-auto flex items-center justify-center bg-gray-50 card-enhanced">
                  <Brain className="w-12 h-12" />
                </div>

                <div className="space-y-4">
                  <h1 className="text-hierarchy-1">QUANTUM PDF READY</h1>
                  <p className="text-lg text-gray-600 leading-relaxed">
                    {disabled
                      ? "Upload PDF documents and configure your AI provider to start chatting"
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
          ) : (
            <div className="space-y-8">
              {messages.map((message) => (
                <div key={message.id} className="space-y-4" role="article" aria-label={`${message.role} message`}>
                  {/* Message Header */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
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
                      <div className="flex items-center space-x-3 flex-wrap gap-2">
                        {message.metadata.responseTime && (
                          <Badge variant="outline" className="text-xs border-gray-300">
                            <Clock className="w-3 h-3 mr-1" />
                            {formatResponseTime(message.metadata.responseTime)}
                          </Badge>
                        )}
                        {message.metadata.relevanceScore && (
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
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <MessageContent content={message.content} />
                      </div>

                      {/* Message Actions */}
                      <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(message.content)}
                          className={`h-8 w-8 p-0 ${message.role === "user" ? "text-white hover:bg-white/20" : "text-gray-600 hover:bg-gray-100"}`}
                          aria-label="Copy message"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        {message.role === "assistant" && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-gray-600 hover:bg-gray-100"
                              aria-label="Thumbs up"
                            >
                              <ThumbsUp className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-gray-600 hover:bg-gray-100"
                              aria-label="Thumbs down"
                            >
                              <ThumbsDown className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {message.sources && message.sources.length > 0 && (
                      <Card className="mt-6 border border-gray-200 bg-gray-50">
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-2 mb-4">
                            <FileText className="w-4 h-4 text-gray-600" />
                            <span className="text-sm font-bold text-gray-700">SOURCES ({message.sources.length})</span>
                          </div>
                          <div className="space-y-3">
                            {message.sources.map((source, index) => (
                              <div
                                key={index}
                                className="text-sm bg-white p-3 border border-gray-200 font-mono rounded-sm"
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
                <div className="space-y-4" role="status" aria-live="polite" aria-label="AI is processing your request">
                  <div className="flex items-center space-x-4">
                    <Badge variant="outline" className="border-gray-400 text-gray-700 font-bold px-3 py-1">
                      ASSISTANT
                    </Badge>
                    <time className="text-sm text-gray-500 font-mono">{formatTimestamp(new Date())}</time>
                  </div>
                  <div className="message-bubble message-bubble-assistant">
                    <div className="flex items-center space-x-4">
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span className="text-base">Analyzing documents and generating response...</span>
                    </div>
                    <div className="mt-4 text-sm text-gray-500 space-y-2">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                        <span>Searching relevant content</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div
                          className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"
                          style={{ animationDelay: "0.2s" }}
                        ></div>
                        <span>Generating embeddings</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div
                          className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"
                          style={{ animationDelay: "0.4s" }}
                        ></div>
                        <span>Processing with AI model</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t-2 border-black bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <form onSubmit={handleSubmit} className="space-y-4 form-enhanced">
            <div className="flex space-x-4">
              <div className="flex-1">
                <label htmlFor="chat-input" className="sr-only">
                  Ask a question about your documents
                </label>
                <Textarea
                  id="chat-input"
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    disabled
                      ? "Configure AI provider and upload documents to start chatting..."
                      : "Ask a question about your documents... (Shift+Enter for new line)"
                  }
                  disabled={disabled || isProcessing}
                  className="min-h-[3rem] max-h-[7.5rem] resize-none border-2 border-black focus:ring-0 focus:border-black font-mono text-base leading-relaxed"
                  rows={1}
                />
              </div>
              <Button
                type="submit"
                disabled={disabled || isProcessing || !input.trim()}
                className="border-2 border-black bg-black text-white hover:bg-white hover:text-black px-6 h-12 btn-enhanced self-end"
                aria-label="Send message"
              >
                {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </Button>
            </div>

            {!disabled && (
              <div className="text-center text-sm text-gray-500 space-y-1">
                <p>
                  <span className="font-bold">TIP:</span> Ask specific questions about your documents for better results
                </p>
                <p className="text-xs">
                  Use <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">Shift+Enter</kbd>{" "}
                  for new lines
                </p>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
